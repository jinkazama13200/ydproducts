import React, { useEffect, useState } from 'react';

export function AnimatedNumber({ value, duration = 0.5 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + diff * eased);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default AnimatedNumber;