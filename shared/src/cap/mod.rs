use arc_swap::ArcSwapOption;
use cap_std::fs::{Metadata, OpenOptions};
use std::{
    borrow::Cow,
    collections::VecDeque,
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

mod utils;

pub use utils::{AsyncReadDir, AsyncWalkDir, FileType, ReadDir, WalkDir, WalkEntry};

#[derive(Debug, Clone)]
pub struct CapFilesystem {
    pub base_path: Arc<Path>,
    pub(super) inner: Arc<ArcSwapOption<cap_std::fs::Dir>>,
}

impl CapFilesystem {
    pub async fn new(base_path: &Path) -> Result<Self, std::io::Error> {
        let base_path: Arc<Path> = Arc::from(base_path);

        let inner = tokio::task::spawn_blocking({
            let base_path = base_path.clone();

            move || cap_std::fs::Dir::open_ambient_dir(&*base_path, cap_std::ambient_authority())
        })
        .await??;

        Ok(Self {
            base_path,
            inner: Arc::new(ArcSwapOption::new(Some(Arc::new(inner)))),
        })
    }

    pub fn new_sync(base_path: &Path) -> Result<Self, std::io::Error> {
        let inner = cap_std::fs::Dir::open_ambient_dir(base_path, cap_std::ambient_authority())?;

        Ok(Self {
            base_path: Arc::from(base_path),
            inner: Arc::new(ArcSwapOption::new(Some(Arc::new(inner)))),
        })
    }

    pub fn new_uninitialized(base_path: &Path) -> Self {
        Self {
            base_path: Arc::from(base_path),
            inner: Arc::new(ArcSwapOption::empty()),
        }
    }

    #[inline]
    pub fn is_uninitialized(&self) -> bool {
        self.inner.load().is_none()
    }

    /// Closes the inner fd, preventing any further operations from succeeding.
    #[inline]
    pub fn close(&self) {
        self.inner.store(None);
    }

    #[inline]
    pub fn get_inner(&self) -> Result<Arc<cap_std::fs::Dir>, std::io::Error> {
        self.inner
            .load_full()
            .ok_or_else(|| std::io::Error::other("filesystem not initialized"))
    }

    #[inline]
    pub fn resolve_path(path: &Path) -> PathBuf {
        let mut result = PathBuf::new();

        for component in path.components() {
            match component {
                std::path::Component::ParentDir => {
                    if !result.as_os_str().is_empty()
                        && result.components().next_back() != Some(std::path::Component::RootDir)
                    {
                        result.pop();
                    }
                }
                std::path::Component::CurDir => {}
                _ => {
                    result.push(component);
                }
            }
        }

        result
    }

    /// Borrows `path` when it is already relative and free of `.` / `..` components.
    #[inline]
    pub fn relative_path_cow<'a>(&self, path: &'a Path) -> Cow<'a, Path> {
        let path = path
            .strip_prefix(&*self.base_path)
            .or_else(|_| path.strip_prefix("/"))
            .unwrap_or(path);

        if path
            .components()
            .all(|component| matches!(component, std::path::Component::Normal(_)))
        {
            Cow::Borrowed(path)
        } else {
            Cow::Owned(Self::resolve_path(path))
        }
    }

    #[inline]
    pub fn relative_path(&self, path: &Path) -> PathBuf {
        self.relative_path_cow(path).into_owned()
    }

    #[inline]
    async fn blocking<T: Send + 'static>(
        &self,
        f: impl FnOnce(&Self) -> Result<T, std::io::Error> + Send + 'static,
    ) -> Result<T, std::io::Error> {
        let filesystem = self.clone();

        tokio::task::spawn_blocking(move || f(&filesystem)).await?
    }

    pub async fn async_create_dir(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.create_dir(path))
            .await
    }

    pub fn create_dir(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.create_dir(path)
    }

    pub async fn async_create_dir_all(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.create_dir_all(path))
            .await
    }

    pub fn create_dir_all(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());
        if path.as_os_str().is_empty() {
            return Ok(());
        }

        let inner = self.get_inner()?;
        inner.create_dir_all(path)
    }

    pub async fn async_remove_file(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.remove_file(path))
            .await
    }

    pub fn remove_file(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.remove_file(path)
    }

    pub async fn async_remove_dir(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.remove_dir(path))
            .await
    }

    pub fn remove_dir(&self, path: impl AsRef<Path>) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.remove_dir(path)
    }

    pub async fn async_rename(
        &self,
        from: impl AsRef<Path>,
        to_dir: &CapFilesystem,
        to: impl AsRef<Path>,
    ) -> Result<(), std::io::Error> {
        let from = from.as_ref().to_path_buf();
        let to_dir = to_dir.clone();
        let to = to.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.rename(from, &to_dir, to))
            .await
    }

    pub fn rename(
        &self,
        from: impl AsRef<Path>,
        to_dir: &CapFilesystem,
        to: impl AsRef<Path>,
    ) -> Result<(), std::io::Error> {
        let from = self.relative_path(from.as_ref());
        let to = to_dir.relative_path(to.as_ref());

        let inner = self.get_inner()?;
        let to_inner = to_dir.get_inner()?;
        inner.rename(from, &to_inner, to)
    }

    pub async fn async_metadata(&self, path: impl AsRef<Path>) -> Result<Metadata, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.metadata(path))
            .await
    }

    pub fn metadata(&self, path: impl AsRef<Path>) -> Result<Metadata, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let metadata = if path.components().next().is_none() {
            Metadata::from_just_metadata(std::fs::metadata(&*self.base_path)?)
        } else {
            let inner = self.get_inner()?;

            inner.metadata(path)?
        };

        Ok(metadata)
    }

    pub async fn async_symlink_metadata(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<Metadata, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.symlink_metadata(path))
            .await
    }

    pub fn symlink_metadata(&self, path: impl AsRef<Path>) -> Result<Metadata, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let metadata = if path.components().next().is_none() {
            Metadata::from_just_metadata(std::fs::symlink_metadata(&*self.base_path)?)
        } else {
            let inner = self.get_inner()?;

            Self::stat_beneath(&inner, &path)?
        };

        Ok(metadata)
    }

    /// Stats a path relative to `inner`, keeping the birth time on every target.
    ///
    /// `cap-primitives` only reaches its `statx` fast path for a single-component
    /// no-follow stat; anything deeper falls back to `O_PATH` + `File::metadata`.
    /// On glibc that still carries a birth time, so the stat goes straight
    /// through. `std` only implements `statx` for `target_env = "gnu"`, so on
    /// musl the deeper path loses `created` entirely, and opening the parent
    /// first is what keeps the fast path reachable.
    #[cfg(target_env = "gnu")]
    fn stat_beneath(inner: &cap_std::fs::Dir, path: &Path) -> Result<Metadata, std::io::Error> {
        inner.symlink_metadata(path)
    }

    #[cfg(not(target_env = "gnu"))]
    fn stat_beneath(inner: &cap_std::fs::Dir, path: &Path) -> Result<Metadata, std::io::Error> {
        match (path.parent(), path.file_name()) {
            (Some(parent), Some(name)) if !parent.as_os_str().is_empty() => {
                inner.open_dir(parent)?.symlink_metadata(name)
            }
            _ => inner.symlink_metadata(path),
        }
    }

    pub async fn async_canonicalize(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<PathBuf, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.canonicalize(path))
            .await
    }

    pub fn canonicalize(&self, path: impl AsRef<Path>) -> Result<PathBuf, std::io::Error> {
        let path = self.relative_path(path.as_ref());
        if path.components().next().is_none() {
            return Ok(path);
        }

        let inner = self.get_inner()?;
        inner.canonicalize(path)
    }

    pub async fn async_read_link(&self, path: impl AsRef<Path>) -> Result<PathBuf, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        self.blocking(move |filesystem| filesystem.read_link(path))
            .await
    }

    pub fn read_link(&self, path: impl AsRef<Path>) -> Result<PathBuf, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.read_link(path)
    }

    pub fn read_link_contents(&self, path: impl AsRef<Path>) -> Result<PathBuf, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.read_link_contents(path)
    }

    pub async fn async_read_to_string(
        &self,
        path: impl AsRef<Path>,
        limit: usize,
    ) -> Result<String, std::io::Error> {
        let content = self.async_read_to_vec(path, limit).await?;

        String::from_utf8(content)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))
    }

    pub fn read_to_string(
        &self,
        path: impl AsRef<Path>,
        limit: usize,
    ) -> Result<String, std::io::Error> {
        let content = self.read_to_vec(path, limit)?;

        String::from_utf8(content)
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::InvalidData, err))
    }

    pub async fn async_read_to_vec(
        &self,
        path: impl AsRef<Path>,
        limit: usize,
    ) -> Result<Vec<u8>, std::io::Error> {
        let file = self.async_open(path).await?;

        let mut content = Vec::new();
        file.take(limit as u64).read_to_end(&mut content).await?;

        Ok(content)
    }

    pub fn read_to_vec(
        &self,
        path: impl AsRef<Path>,
        limit: usize,
    ) -> Result<Vec<u8>, std::io::Error> {
        let mut content = Vec::new();
        std::io::Read::read_to_end(
            &mut std::io::Read::take(self.open(path)?, limit as u64),
            &mut content,
        )?;

        Ok(content)
    }

    pub async fn async_open(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<tokio::fs::File, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        let file = self
            .blocking(move |filesystem| filesystem.open(path))
            .await?;

        Ok(tokio::fs::File::from_std(file))
    }

    pub fn open(&self, path: impl AsRef<Path>) -> Result<std::fs::File, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        Ok(inner.open(path)?.into_std())
    }

    pub fn open_with(
        &self,
        path: impl AsRef<Path>,
        options: OpenOptions,
    ) -> Result<std::fs::File, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        Ok(inner.open_with(path, &options)?.into_std())
    }

    pub async fn async_write(
        &self,
        path: impl AsRef<Path>,
        data: impl AsRef<[u8]>,
    ) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let mut file = self.async_create(path).await?;
        file.write_all(data.as_ref()).await?;
        file.sync_all().await?;

        Ok(())
    }

    pub fn write(
        &self,
        path: impl AsRef<Path>,
        data: impl AsRef<[u8]>,
    ) -> Result<(), std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        inner.write(path, data)
    }

    pub async fn async_create(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<tokio::fs::File, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        let file = self
            .blocking(move |filesystem| filesystem.create(path))
            .await?;

        Ok(tokio::fs::File::from_std(file))
    }

    pub fn create(&self, path: impl AsRef<Path>) -> Result<std::fs::File, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;
        Ok(inner.create(path)?.into_std())
    }

    pub async fn async_read_dir_all(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<Vec<String>, std::io::Error> {
        let mut read_dir = self.async_read_dir(path).await?;

        let mut names = Vec::new();
        while let Some(Ok((_, entry))) = read_dir.next_entry().await {
            names.push(entry);
        }

        Ok(names)
    }

    pub async fn async_read_dir(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<AsyncReadDir, std::io::Error> {
        let path = path.as_ref().to_path_buf();

        let ReadDir(read_dir) = self
            .blocking(move |filesystem| filesystem.read_dir(path))
            .await?;

        Ok(AsyncReadDir(
            Some(read_dir),
            Some(VecDeque::with_capacity(128)),
        ))
    }

    pub fn read_dir(&self, path: impl AsRef<Path>) -> Result<ReadDir, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        let inner = self.get_inner()?;

        Ok(ReadDir(if path.components().next().is_none() {
            inner.entries()?
        } else {
            inner.read_dir(path)?
        }))
    }

    pub async fn async_walk_dir(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<AsyncWalkDir<'_>, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        AsyncWalkDir::new(self.clone(), path).await
    }

    pub fn walk_dir(&self, path: impl AsRef<Path>) -> Result<WalkDir<'_>, std::io::Error> {
        let path = self.relative_path(path.as_ref());

        WalkDir::new(self.clone(), path)
    }
}
