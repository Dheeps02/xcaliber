use crate::http::state::AppState;
use axum::{
    extract::State,
    response::{Sse, sse::Event},
};
use futures_util::stream::{self, Stream};
use std::{convert::Infallible, sync::Arc, time::Duration};
use tokio_stream::{StreamExt, wrappers::BroadcastStream};

pub async fn sse_handler(
    State(state): State<Arc<AppState>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.tx.subscribe();
    let stream = BroadcastStream::new(rx)
        .filter_map(|msg| msg.ok())
        .map(|data| Ok(Event::default().data(data)));

    Sse::new(stream)
        .keep_alive(axum::response::sse::KeepAlive::new().interval(Duration::from_secs(15)))
}
