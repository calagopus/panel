import { ReactNode } from 'react';

export default function EggCardGrid({ children }: { children: ReactNode }) {
  return <div className='grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-3'>{children}</div>;
}
