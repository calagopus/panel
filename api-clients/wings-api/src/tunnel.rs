use super::client::{ApiHttpError, WingsClient};
use futures_util::{SinkExt, StreamExt, ready};
use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream,
    tungstenite::{Error as WsError, Message},
};

type WsStream = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

pub const MAX_DATAGRAM_SIZE: usize = 65536;

const RECV_TIMEOUT: Duration = Duration::from_secs(5);

const REFUSED_SIGNAL: &str = "refused";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueryProtocol {
    Tcp,
    Udp,
}

impl QueryProtocol {
    fn as_str(self) -> &'static str {
        match self {
            QueryProtocol::Tcp => "tcp",
            QueryProtocol::Udp => "udp",
        }
    }
}

impl WingsClient {
    async fn open_tunnel(
        &self,
        server: uuid::Uuid,
        protocol: QueryProtocol,
        port: u16,
    ) -> Result<WsStream, ApiHttpError> {
        self.open_websocket(
            format!(
                "/api/servers/{server}/ws/query?protocol={}&port={port}",
                protocol.as_str()
            ),
            reqwest::header::HeaderMap::new(),
        )
        .await
    }

    pub async fn open_tunnel_tcp(
        &self,
        server: uuid::Uuid,
        port: u16,
    ) -> Result<QueryTcpTunnel, ApiHttpError> {
        Ok(QueryTcpTunnel {
            stream: self.open_tunnel(server, QueryProtocol::Tcp, port).await?,
            read: Vec::new(),
            read_pos: 0,
        })
    }

    pub async fn open_tunnel_udp(
        &self,
        server: uuid::Uuid,
        port: u16,
    ) -> Result<QueryUdpTunnel, ApiHttpError> {
        Ok(QueryUdpTunnel {
            stream: self.open_tunnel(server, QueryProtocol::Udp, port).await?,
        })
    }
}

pub struct QueryTcpTunnel {
    stream: WsStream,
    read: Vec<u8>,
    read_pos: usize,
}

impl AsyncRead for QueryTcpTunnel {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        loop {
            if self.read_pos < self.read.len() {
                let n = (self.read.len() - self.read_pos).min(buf.remaining());
                let start = self.read_pos;
                buf.put_slice(&self.read[start..start + n]);
                self.read_pos += n;
                return Poll::Ready(Ok(()));
            }

            match ready!(self.stream.poll_next_unpin(cx)) {
                Some(Ok(Message::Binary(data))) => {
                    self.read = data.to_vec();
                    self.read_pos = 0;
                }
                Some(Ok(Message::Close(_))) | None => return Poll::Ready(Ok(())),
                Some(Ok(_)) => {}
                Some(Err(err)) => return Poll::Ready(Err(ws_to_io(err))),
            }
        }
    }
}

impl AsyncWrite for QueryTcpTunnel {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        ready!(self.stream.poll_ready_unpin(cx)).map_err(ws_to_io)?;
        self.stream
            .start_send_unpin(Message::binary(buf.to_vec()))
            .map_err(ws_to_io)?;
        Poll::Ready(Ok(buf.len()))
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.stream.poll_flush_unpin(cx).map_err(ws_to_io)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.stream.poll_close_unpin(cx).map_err(ws_to_io)
    }
}

pub struct QueryUdpTunnel {
    stream: WsStream,
}

impl QueryUdpTunnel {
    pub async fn send(&mut self, data: &[u8]) -> io::Result<()> {
        self.stream
            .send(Message::binary(data.to_vec()))
            .await
            .map_err(ws_to_io)
    }

    pub async fn recv(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            let message = match tokio::time::timeout(RECV_TIMEOUT, self.stream.next()).await {
                Ok(Some(Ok(message))) => message,
                Ok(Some(Err(err))) => return Err(ws_to_io(err)),
                Ok(None) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Err(_) => return Err(io::ErrorKind::TimedOut.into()),
            };

            match message {
                Message::Binary(data) => {
                    let n = data.len().min(buf.len());
                    buf[..n].copy_from_slice(&data[..n]);
                    return Ok(n);
                }
                Message::Close(_) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Message::Text(text) if text.as_str() == REFUSED_SIGNAL => {
                    return Err(io::ErrorKind::ConnectionRefused.into());
                }
                _ => {}
            }
        }
    }
}

fn ws_to_io(err: WsError) -> io::Error {
    match err {
        WsError::Io(err) => err,
        other => io::Error::other(other),
    }
}
