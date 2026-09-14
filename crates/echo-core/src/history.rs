use crate::{rules, Pose};
use std::collections::VecDeque;

struct Frame {
    at: f64,
    poses: Vec<Pose>,
}

/// Bounded authoritative pose history. Missing history never falls back to live poses.
#[derive(Default)]
pub struct History {
    frames: VecDeque<Frame>,
}

impl History {
    pub fn clear(&mut self) {
        self.frames.clear();
    }

    /// The simulation supplies monotonically ordered timestamps in milliseconds.
    pub fn record(&mut self, at: f64, poses: Vec<Pose>) {
        self.frames.push_back(Frame { at, poses });
        // Keep the predecessor at the retention boundary for interpolation.
        while self.frames.len() > 2 && self.frames[1].at < at - rules().history_ms as f64 {
            self.frames.pop_front();
        }
    }

    pub fn sample(&self, at: f64) -> Vec<Pose> {
        if !at.is_finite() {
            return Vec::new();
        }
        let Some(first) = self.frames.front() else {
            return Vec::new();
        };
        if at < first.at {
            return Vec::new();
        }
        let Some(last) = self.frames.back() else {
            return Vec::new();
        };
        if at >= last.at {
            return last.poses.clone();
        }

        let (older, newer) = self.bracket(at);
        let fraction = ((at - older.at) / (newer.at - older.at).max(0.001)).clamp(0.0, 1.0);
        older
            .poses
            .iter()
            .map(|pose| {
                let next = newer.poses.iter().find(|next| next.id == pose.id);
                interpolate_pose(pose, next, fraction)
            })
            .collect()
    }

    /// Called only when the query is inside the stored time range.
    fn bracket(&self, at: f64) -> (&Frame, &Frame) {
        let mut older = 0;
        let mut newer = self.frames.len() - 1;
        while newer - older > 1 {
            let middle = (older + newer) / 2;
            if self.frames[middle].at <= at {
                older = middle;
            } else {
                newer = middle;
            }
        }
        (&self.frames[older], &self.frames[newer])
    }
}

fn interpolate_pose(pose: &Pose, next: Option<&Pose>, fraction: f64) -> Pose {
    let Some(next) = next else {
        return pose.clone();
    };
    // Teleports, death, and role changes are discontinuities, never interpolated slides.
    if pose.role != next.role || pose.alive != next.alive || pose.warp != next.warp {
        return pose.clone();
    }
    let mut output = pose.clone();
    output.x += (next.x - pose.x) * fraction;
    output.y += (next.y - pose.y) * fraction;
    output.z += (next.z - pose.z) * fraction;
    let yaw_delta = next.yaw - pose.yaw;
    output.yaw += yaw_delta.sin().atan2(yaw_delta.cos()) * fraction;
    output.pitch += (next.pitch - pose.pitch) * fraction;
    output.moving += (next.moving - pose.moving) * fraction;
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Role;

    fn pose(x: f64) -> Pose {
        Pose {
            id: "hider".into(),
            x,
            alive: true,
            ..Pose::default()
        }
    }

    #[test]
    fn retained_frames_are_bounded() {
        let mut history = History::default();
        for tick in 0..10000 {
            history.record(tick as f64 * 1000.0 / rules().tick_rate as f64, vec![]);
        }
        assert!(history.frames.len() <= (rules().history_ms * rules().tick_rate / 1000 + 2) as usize);
    }

    #[test]
    fn missing_or_invalid_history_never_returns_live_positions() {
        let mut history = History::default();
        assert!(history.sample(0.0).is_empty());
        history.record(100.0, vec![pose(12.0)]);
        for at in [0.0, 99.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert!(history.sample(at).is_empty());
        }
    }

    #[test]
    fn interpolation_uses_the_two_bracketing_frames() {
        let mut history = History::default();
        history.record(100.0, vec![pose(0.0)]);
        history.record(200.0, vec![pose(10.0)]);
        history.record(300.0, vec![pose(30.0)]);
        assert!((history.sample(150.0)[0].x - 5.0).abs() < 1e-9);
        assert!((history.sample(250.0)[0].x - 20.0).abs() < 1e-9);
        assert!((history.sample(300.0)[0].x - 30.0).abs() < 1e-9);
    }

    #[test]
    fn discrete_transitions_hold_the_older_pose() {
        let older = pose(0.0);
        let mut newer = pose(10.0);
        newer.warp = 1;
        assert_eq!(interpolate_pose(&older, Some(&newer), 0.5).x, 0.0);
        newer.warp = 0;
        newer.alive = false;
        assert_eq!(interpolate_pose(&older, Some(&newer), 0.5).x, 0.0);
        newer.alive = true;
        newer.role = Role::Seeker;
        assert_eq!(interpolate_pose(&older, Some(&newer), 0.5).x, 0.0);
    }

    #[test]
    fn yaw_takes_the_short_arc_across_pi() {
        let mut older = pose(0.0);
        let mut newer = pose(10.0);
        older.yaw = 179.0_f64.to_radians();
        newer.yaw = (-179.0_f64).to_radians();
        let middle = interpolate_pose(&older, Some(&newer), 0.5);
        assert!((middle.yaw.abs() - std::f64::consts::PI).abs() < 1e-9);
    }

    #[test]
    fn newly_visible_players_are_not_added_before_their_historical_frame() {
        let mut history = History::default();
        history.record(100.0, vec![pose(0.0)]);
        let mut newcomer = pose(99.0);
        newcomer.id = "newcomer".into();
        history.record(200.0, vec![newcomer]);
        let sample = history.sample(150.0);
        assert_eq!(sample.len(), 1);
        assert_eq!(sample[0].id, "hider");
        assert_eq!(sample[0].x, 0.0);
    }

    #[test]
    fn clearing_history_prevents_a_previous_round_from_being_sampled() {
        let mut history = History::default();
        history.record(100.0, vec![pose(1.0)]);
        history.clear();
        assert!(history.sample(100.0).is_empty());
    }
}
