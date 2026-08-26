import useServerBackupSocket from './hooks/useServerBackupSocket.ts';
import useServerFileOperationSocket from './hooks/useServerFileOperationSocket.ts';
import useServerInstallSocket from './hooks/useServerInstallSocket.ts';
import useServerScheduleSocket from './hooks/useServerScheduleSocket.ts';
import useServerStatsSocket from './hooks/useServerStatsSocket.ts';
import useServerTransferSocket from './hooks/useServerTransferSocket.ts';

export default function WebsocketListener() {
  useServerStatsSocket();
  useServerBackupSocket();
  useServerTransferSocket();
  useServerInstallSocket();
  useServerScheduleSocket();
  useServerFileOperationSocket();

  return null;
}
