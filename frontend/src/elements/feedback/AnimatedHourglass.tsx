import { faHourglassEnd, faHourglassHalf, faHourglassStart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { makeComponentHookable } from 'shared';

function AnimatedHourglass() {
  const [stage, setStage] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prevStage) => {
        const nextStage = (prevStage + 1) % 3;
        if (nextStage === 0) {
          setRotation((prevRotation) => prevRotation + 180);
          setFlipped((prev) => !prev);
        }
        return nextStage;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getIcon = () => {
    if (!flipped) {
      switch (stage) {
        case 0:
          return faHourglassStart;
        case 1:
          return faHourglassHalf;
        case 2:
          return faHourglassEnd;
        default:
          return faHourglassStart;
      }
    } else {
      // Reverse the stages when flipped
      switch (stage) {
        case 0:
          return faHourglassEnd;
        case 1:
          return faHourglassHalf;
        case 2:
          return faHourglassStart;
        default:
          return faHourglassEnd;
      }
    }
  };

  return (
    <div
      className='transition-transform duration-700 ease-in-out cursor-wait'
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <FontAwesomeIcon icon={getIcon()} size='xl' className='animate-pulse' />
    </div>
  );
}

export default makeComponentHookable(AnimatedHourglass);
