use std::io;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
pub const MAX_CONTROL: usize = 16_384;
pub const MAX_SNAPSHOT: usize = 65_536;
pub async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> io::Result<String> {
    let size = reader.read_u32().await? as usize;
    if size == 0 || size > MAX_CONTROL { return Err(io::Error::new(io::ErrorKind::InvalidData, "frame length")); }
    let mut bytes = vec![0; size]; reader.read_exact(&mut bytes).await?;
    String::from_utf8(bytes).map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "UTF-8"))
}
pub async fn write_frame<W: AsyncWrite + Unpin>(writer: &mut W, text: &str, maximum: usize) -> io::Result<()> {
    if text.is_empty() || text.len() > maximum { return Err(io::Error::new(io::ErrorKind::InvalidData, "frame length")); }
    writer.write_u32(text.len() as u32).await?; writer.write_all(text.as_bytes()).await?; Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test] async fn frames_roundtrip() {
        let (mut tx, mut rx) = tokio::io::duplex(64);
        let task = tokio::spawn(async move { write_frame(&mut tx, "{\"name\":\"Куба\"}", MAX_CONTROL).await.unwrap(); });
        assert_eq!(read_frame(&mut rx).await.unwrap(), "{\"name\":\"Куба\"}"); task.await.unwrap();
    }
    #[tokio::test] async fn reject_length_before_body_allocation() {
        let mut bytes = &b"\xff\xff\xff\xff"[..];
        assert_eq!(read_frame(&mut bytes).await.unwrap_err().kind(), io::ErrorKind::InvalidData);
    }
    #[tokio::test] async fn reject_truncated_and_invalid_utf8() {
        for bytes in [&b"\0\0\0\x04xy"[..], &b"\0\0\0\x01\xff"[..]] {
            let mut bytes = bytes; assert!(read_frame(&mut bytes).await.is_err());
        }
    }
}
