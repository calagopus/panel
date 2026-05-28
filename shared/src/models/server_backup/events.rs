use crate::models::EventEmittingModel;
use std::sync::LazyLock;

#[non_exhaustive]
pub enum ServerBackupEvent {
    /// Emitted when a server backup restore starts.
    RestoreStarted {
        backup: Box<super::ServerBackup>,
        server: Box<crate::models::server::Server>,
    },
    /// Emitted when a server backup restore completes, either successfully or unsuccessfully.
    RestoreCompleted {
        backup: Box<super::ServerBackup>,
        server: Box<crate::models::server::Server>,
        successful: bool,
    },
    /// Emitted when a server backup creation completes, either successfully or unsuccessfully.
    CreationCompleted {
        backup: Box<super::ServerBackup>,
        successful: bool,
    },
}

#[async_trait::async_trait]
impl EventEmittingModel for super::ServerBackup {
    type Event = ServerBackupEvent;

    fn get_event_emitter() -> &'static crate::events::EventEmitter<Self::Event> {
        static EVENT_EMITTER: LazyLock<crate::events::EventEmitter<ServerBackupEvent>> =
            LazyLock::new(crate::events::EventEmitter::default);

        &EVENT_EMITTER
    }
}
