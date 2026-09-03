import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { makeComponentHookable } from 'shared';
import Card from '@/elements/data-display/Card.tsx';

function ActionBar({ opened = false, children }: { opened?: boolean; children: React.ReactNode }) {
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
          <Card p='sm' className='flex! flex-row! flex-wrap! justify-center md:w-fit gap-2 pointer-events-auto mx-4'>
            {children}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default makeComponentHookable(ActionBar);
