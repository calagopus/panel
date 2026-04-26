pub use crate::models::{
    BaseModel, ByUuid, CreatableModel, CreateListenerList, DeletableModel, DeleteListenerList,
    EventEmittingModel, Fetchable, IntoAdminApiObject, IntoApiObject, ListenerPriority,
    ModelHandlerList, OrderedJson, UpdatableModel, UpdateListenerList,
};
use futures_util::{StreamExt, TryStreamExt};
pub use schema_extension_core::finish_extendible;
use std::borrow::Cow;

pub trait IteratorExt<R, E>: Iterator<Item = Result<R, E>> {
    fn try_collect_vec(self) -> Result<Vec<R>, E>
    where
        Self: Sized,
    {
        let mut vec = Vec::new();

        let (hint_min, hint_max) = self.size_hint();
        if let Some(hint_max) = hint_max
            && hint_min == hint_max
        {
            vec.reserve_exact(hint_max);
        }

        for item in self {
            vec.push(item?);
        }

        Ok(vec)
    }

    fn try_collect_vecdeque(self) -> Result<std::collections::VecDeque<R>, E>
    where
        Self: Sized,
    {
        let mut deque = std::collections::VecDeque::new();

        let (hint_min, hint_max) = self.size_hint();
        if let Some(hint_max) = hint_max
            && hint_min == hint_max
        {
            deque.reserve_exact(hint_max);
        }

        for item in self {
            deque.push_back(item?);
        }

        Ok(deque)
    }

    fn try_collect_set(self) -> Result<std::collections::HashSet<R>, E>
    where
        Self: Sized,
        R: std::hash::Hash + Eq,
    {
        let mut set = std::collections::HashSet::new();

        for item in self {
            set.insert(item?);
        }

        Ok(set)
    }
}

impl<R, E, T: Iterator<Item = Result<R, E>>> IteratorExt<R, E> for T {}

#[async_trait::async_trait]
pub trait AsyncIteratorExt<R: Send, E: Send, F: Future<Output = Result<R, E>> + Send>:
    Iterator<Item = F> + Sized + Send
{
    async fn try_collect_async_vec(self) -> Result<Vec<R>, E>
    where
        Self: Sized,
    {
        let mut vec = Vec::new();

        let (hint_min, hint_max) = self.size_hint();
        if let Some(hint_max) = hint_max
            && hint_min == hint_max
        {
            vec.reserve_exact(hint_max);
        }

        let mut result_stream = futures_util::stream::iter(self).buffered(25);

        while let Some(result) = result_stream.try_next().await? {
            vec.push(result);
        }

        Ok(vec)
    }
}

impl<
    R: Send,
    E: Send,
    F: Future<Output = Result<R, E>> + Send,
    T: Iterator<Item = F> + Sized + Send,
> AsyncIteratorExt<R, E, F> for T
{
}

pub trait OptionExt<T> {
    fn try_map<R, E, F: FnMut(T) -> Result<R, E>>(self, f: F) -> Result<Option<R>, E>;
}

impl<T> OptionExt<T> for Option<T> {
    #[inline]
    fn try_map<R, E, F: FnMut(T) -> Result<R, E>>(self, mut f: F) -> Result<Option<R>, E> {
        match self {
            Some(item) => Ok(Some(f(item)?)),
            None => Ok(None),
        }
    }
}

#[async_trait::async_trait]
pub trait AsyncOptionExt<T, Fut: Future<Output = T>> {
    async fn awaited(self) -> Option<T>;
}

#[async_trait::async_trait]
impl<T, Fut: Future<Output = T> + Send> AsyncOptionExt<T, Fut> for Option<Fut> {
    #[inline]
    async fn awaited(self) -> Option<T> {
        match self {
            Some(item) => Some(item.await),
            None => None,
        }
    }
}

pub trait SqlxErrorExt {
    fn is_unique_violation(&self) -> bool;
    fn is_foreign_key_violation(&self) -> bool;
    fn is_check_violation(&self) -> bool;

    fn code(&self) -> Option<Cow<'_, str>>;
    fn message(&self) -> Option<&str>;
}

impl SqlxErrorExt for sqlx::Error {
    #[inline]
    fn is_unique_violation(&self) -> bool {
        self.as_database_error()
            .is_some_and(|e| e.is_unique_violation())
    }

    #[inline]
    fn is_foreign_key_violation(&self) -> bool {
        self.as_database_error()
            .is_some_and(|e| e.is_foreign_key_violation())
    }

    #[inline]
    fn is_check_violation(&self) -> bool {
        self.as_database_error()
            .is_some_and(|e| e.is_check_violation())
    }

    #[inline]
    fn code(&self) -> Option<Cow<'_, str>> {
        self.as_database_error().and_then(|e| e.code())
    }

    #[inline]
    fn message(&self) -> Option<&str> {
        self.as_database_error().map(|e| e.message())
    }
}

pub trait StringExt: Sized {
    /// Returns Some if the string has content, otherwise None.
    fn optional(&self) -> Option<&Self>;

    /// Returns Some if the string has content, otherwise None.
    fn into_optional(self) -> Option<Self>;
}

impl StringExt for String {
    #[inline]
    fn optional(&self) -> Option<&Self> {
        if self.is_empty() { None } else { Some(self) }
    }

    #[inline]
    fn into_optional(self) -> Option<Self> {
        if self.is_empty() { None } else { Some(self) }
    }
}

impl StringExt for compact_str::CompactString {
    #[inline]
    fn optional(&self) -> Option<&Self> {
        if self.is_empty() { None } else { Some(self) }
    }

    #[inline]
    fn into_optional(self) -> Option<Self> {
        if self.is_empty() { None } else { Some(self) }
    }
}

impl StringExt for &str {
    #[inline]
    fn optional(&self) -> Option<&Self> {
        if self.is_empty() { None } else { Some(self) }
    }

    #[inline]
    fn into_optional(self) -> Option<Self> {
        if self.is_empty() { None } else { Some(self) }
    }
}
