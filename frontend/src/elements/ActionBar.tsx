import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import Card from './Card.tsx';

export default function ActionBar({ opened = false, children }: { opened?: boolean; children: React.ReactNode }) {
  return createPortal(
    <AnimatePresence>
      {opened && (
        <motion.div
          className='pointer-events-none fixed bottom-0 mb-2 flex justify-center w-screen z-90'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Card p='sm' className='grid! grid-cols-2 w-full md:w-fit md:grid-flow-col gap-2 pointer-events-auto mx-4'>
            {children}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
