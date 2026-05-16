import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import { announcementTypeColorMapping, announcementTypeIconMapping } from '@/lib/enums.ts';
import { announcementSchema } from '@/lib/schemas/announcements.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Alert from './Alert.tsx';

type Announcement = z.infer<typeof announcementSchema>;

function storageKey(uuid: string) {
  return `announcement_${uuid}`;
}

function checkDismissed(announcement: Announcement): boolean {
  if (!announcement.dismissible) return false;

  const stored = localStorage.getItem(storageKey(announcement.uuid));
  if (stored === null) return false;

  if (announcement.dismissibleEnd === null) {
    if (stored === 'null') return true;
    localStorage.removeItem(storageKey(announcement.uuid));
    return false;
  }

  const end = new Date(announcement.dismissibleEnd);
  if (end <= new Date()) {
    localStorage.removeItem(storageKey(announcement.uuid));
    return false;
  }

  if (stored !== announcement.dismissibleEnd) {
    localStorage.removeItem(storageKey(announcement.uuid));
    return false;
  }

  return true;
}

function canShowDismissButton(announcement: Announcement): boolean {
  if (!announcement.dismissible) return false;
  if (announcement.dismissibleEnd === null) return true;
  return new Date(announcement.dismissibleEnd) > new Date();
}

export default function DismissibleAnnouncementAlert({ announcement }: { announcement: Announcement }) {
  const { language } = useTranslations();
  const [dismissed, setDismissed] = useState(() => checkDismissed(announcement));

  if (dismissed) return null;

  const handleDismiss = () => {
    const value = announcement.dismissibleEnd === null ? 'null' : announcement.dismissibleEnd;
    localStorage.setItem(storageKey(announcement.uuid), value);
    setDismissed(true);
  };

  return (
    <Alert
      icon={<FontAwesomeIcon icon={announcementTypeIconMapping[announcement.type]} />}
      key={announcement.uuid}
      title={announcement.titleTranslations[language] ?? announcement.title}
      color={announcementTypeColorMapping[announcement.type]}
      className='mt-2 mx-6'
      withCloseButton={canShowDismissButton(announcement)}
      onClose={handleDismiss}
    >
      {(announcement.contentTranslations[language] ?? announcement.content).md()}
    </Alert>
  );
}
