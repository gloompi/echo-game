use crate::{rules,Pose};
use std::collections::VecDeque;
#[derive(Default)]
pub struct History { frames: VecDeque<(f64,Vec<Pose>)> }
impl History {
    pub fn clear(&mut self){self.frames.clear();}
    pub fn record(&mut self,at:f64,poses:Vec<Pose>){
        self.frames.push_back((at,poses));
        while self.frames.len()>2&&self.frames[1].0<at-rules().history_ms as f64{self.frames.pop_front();}
    }
    pub fn sample(&self,at:f64)->Vec<Pose>{
        let Some(first)=self.frames.front() else{return vec![];};
        if at<first.0{return vec![];}
        let Some(last)=self.frames.back() else{return vec![];};
        if at>=last.0{return last.1.clone();}
        let mut low=0;let mut high=self.frames.len()-1;
        while high-low>1{let mid=(low+high)/2;if self.frames[mid].0<=at{low=mid;}else{high=mid;}}
        let(ta,a)=&self.frames[low];let(tb,b)=&self.frames[high];let t=((at-ta)/(tb-ta).max(0.001)).clamp(0.0,1.0);
        a.iter().map(|p|{
            let Some(q)=b.iter().find(|q|q.id==p.id) else{return p.clone();};
            // Warp sequence is historical too. A teleport is a discontinuity, never a long slide.
            if p.role!=q.role||p.alive!=q.alive||p.warp!=q.warp{return p.clone();}
            let mut out=p.clone();out.x+=(q.x-p.x)*t;out.y+=(q.y-p.y)*t;out.z+=(q.z-p.z)*t;
            out.yaw+=(q.yaw-p.yaw).sin().atan2((q.yaw-p.yaw).cos())*t;
            out.pitch+=(q.pitch-p.pitch)*t;out.moving+=(q.moving-p.moving)*t;out
        }).collect()
    }
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn retained_frames_are_bounded(){let mut h=History::default();for tick in 0..10000{h.record(tick as f64*1000.0/rules().tick_rate as f64,vec![]);}assert!(h.frames.len()<=(rules().history_ms*rules().tick_rate/1000+2) as usize);}
}
