// ScaleInput.jsx - Scale/Rating input for skill levels, ratings, satisfaction scores
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * ScaleInput - Visual scale/rating input component
 *
 * Display modes:
 * - segments: Bar with filled/empty segments [#####   ]
 * - emoji: Repeated emoji icons ⭐⭐⭐⭐☆
 * - slider: Traditional range slider
 * - labels: Clickable label buttons
 *
 * Schema example:
 * {
 *   "react_skill": {
 *     "type": "scale",
 *     "label": "React",
 *     "min": 0,
 *     "max": 10,
 *     "step": 1,
 *     "display": "segments",
 *     "emoji": "💻",
 *     "showValue": true,
 *     "labels": ["Beginner", "Intermediate", "Advanced", "Expert"]
 *   }
 * }
 */
export default function ScaleInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  fieldSchema = {},
  error,
  touched,
  disabled = false,
  language
}) {
  const { t } = useFormBuilderLanguage(language);
  const [hoverValue, setHoverValue] = useState(null);

  // Extract schema properties with defaults
  const {
    label,
    min = 0,
    max = 5,
    step = 1,
    display = 'segments', // segments, emoji, slider, labels
    emoji = '⭐',
    emptyEmoji = null, // Optional different emoji for empty state
    showValue = true,
    showLabels = false,
    labels = [], // Custom labels for each step
    labelStart = '', // Label for min value
    labelEnd = '', // Label for max value
    colors = {}, // Custom colors
    size = 'md', // sm, md, lg
    required = false,
    help,
    placeholder
  } = fieldSchema;

  // Calculate number of segments
  const segmentCount = Math.floor((max - min) / step) + 1;
  const segments = useMemo(() => {
    return Array.from({ length: segmentCount }, (_, i) => min + (i * step));
  }, [min, max, step, segmentCount]);

  // Get current value (0-indexed for display)
  const currentValue = value !== undefined && value !== '' ? Number(value) : null;
  const displayValue = hoverValue !== null ? hoverValue : currentValue;

  // Size classes - segments use flex-1 to fill available space responsively
  const sizeClasses = {
    sm: {
      segment: 'h-4 sm:h-5 flex-1 max-w-[60px]',
      emoji: 'text-base sm:text-lg',
      gap: 'gap-1',
      slider: 'h-1',
      label: 'text-xs px-2 py-1',
      sideLabel: 'w-[70px] sm:w-[80px]'
    },
    md: {
      segment: 'h-6 sm:h-7 md:h-8 flex-1 max-w-[80px]',
      emoji: 'text-xl sm:text-2xl',
      gap: 'gap-1 sm:gap-1.5',
      slider: 'h-2',
      label: 'text-sm px-3 py-1.5',
      sideLabel: 'w-[80px] sm:w-[90px]'
    },
    lg: {
      segment: 'h-7 sm:h-8 md:h-10 flex-1 max-w-[100px]',
      emoji: 'text-2xl sm:text-3xl',
      gap: 'gap-1.5 sm:gap-2',
      slider: 'h-3',
      label: 'text-base px-4 py-2',
      sideLabel: 'w-[90px] sm:w-[100px]'
    }
  };

  const sizes = sizeClasses[size] || sizeClasses.md;

  // Colors
  const {
    filled = 'bg-primary',
    empty = 'bg-gray-200 dark:bg-gray-700',
    hover = 'bg-primary/70',
    filledEmoji = null, // Use same emoji but with opacity for unfilled
    track = 'bg-gray-200 dark:bg-gray-700',
    thumb = 'bg-primary'
  } = colors;

  // Handle value change
  const handleChange = useCallback((newValue) => {
    if (disabled) return;
    onChange(newValue);
  }, [disabled, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    const current = currentValue ?? min;
    let newValue = current;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, current + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, current - step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      default:
        return;
    }

    handleChange(newValue);
  }, [disabled, currentValue, min, max, step, handleChange]);

  // Get label for a value
  const getLabelForValue = useCallback((val) => {
    if (labels.length === 0) return null;
    const index = Math.round((val - min) / step);
    return labels[index] || null;
  }, [labels, min, step]);

  // Render segments display
  const renderSegments = () => (
    <div
      className={`flex w-full ${sizes.gap} cursor-pointer`}
      role="slider"
      aria-valuenow={currentValue ?? min}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
    >
      {segments.map((segmentValue, index) => {
        const isFilled = displayValue !== null && segmentValue <= displayValue;
        const isHovering = hoverValue !== null && segmentValue <= hoverValue;

        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className={`
              ${sizes.segment} transition-all duration-150
              ${index === 0 ? 'rounded-l-md' : ''}
              ${index === segments.length - 1 ? 'rounded-r-md' : ''}
              ${isFilled
                ? isHovering && hoverValue !== currentValue
                  ? hover
                  : filled
                : empty
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'}
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:z-10
            `}
            onClick={() => handleChange(segmentValue)}
            onMouseEnter={() => !disabled && setHoverValue(segmentValue)}
            onMouseLeave={() => setHoverValue(null)}
            aria-label={`${segmentValue} ${t('scaleInput.outOf')} ${max}`}
          />
        );
      })}
    </div>
  );

  // Render emoji display
  const renderEmoji = () => (
    <div
      className={`flex ${sizes.gap} cursor-pointer`}
      role="slider"
      aria-valuenow={currentValue ?? min}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
    >
      {segments.map((segmentValue, index) => {
        const isFilled = displayValue !== null && segmentValue <= displayValue;
        const displayEmoji = isFilled ? emoji : (emptyEmoji || emoji);

        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className={`
              ${sizes.emoji} transition-all duration-150 leading-none
              ${isFilled ? 'opacity-100' : 'opacity-30 grayscale'}
              ${disabled ? 'cursor-not-allowed' : 'hover:scale-125 hover:opacity-100 hover:grayscale-0'}
              focus:outline-none focus:scale-125
            `}
            onClick={() => handleChange(segmentValue)}
            onMouseEnter={() => !disabled && setHoverValue(segmentValue)}
            onMouseLeave={() => setHoverValue(null)}
            aria-label={`${segmentValue} ${t('scaleInput.outOf')} ${max}`}
          >
            {displayEmoji}
          </button>
        );
      })}
    </div>
  );

  // Render slider display
  const renderSlider = () => (
    <div className="w-full">
      <input
        type="range"
        id={id}
        name={name}
        min={min}
        max={max}
        step={step}
        value={currentValue ?? min}
        onChange={(e) => handleChange(Number(e.target.value))}
        onBlur={onBlur}
        disabled={disabled}
        className={`
          w-full ${sizes.slider} rounded-lg appearance-none cursor-pointer
          ${track}
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:${thumb}
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:${thumb}
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          focus:outline-none focus:ring-2 focus:ring-primary/50
        `}
        aria-label={label}
      />
      {/* Tick marks */}
      {showLabels && (
        <div className="flex justify-between mt-1 px-1">
          {segments.map((segmentValue, index) => (
            <span
              key={index}
              className="text-xs text-gray-400"
            >
              {segmentValue}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // Render labels display (clickable buttons)
  const renderLabels = () => (
    <div
      className={`flex flex-wrap ${sizes.gap}`}
      role="radiogroup"
      aria-label={label}
      onBlur={onBlur}
    >
      {labels.length > 0 ? (
        labels.map((labelText, index) => {
          const labelValue = min + (index * step);
          const isSelected = currentValue === labelValue;

          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              className={`
                ${sizes.label} rounded-full border-2 transition-all duration-150
                ${isSelected
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                focus:outline-none focus:ring-2 focus:ring-primary/50
              `}
              onClick={() => handleChange(labelValue)}
            >
              {labelText}
            </button>
          );
        })
      ) : (
        // Fallback to numeric labels
        segments.map((segmentValue, index) => {
          const isSelected = currentValue === segmentValue;

          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              className={`
                ${sizes.label} rounded-full border-2 min-w-[2.5rem] transition-all duration-150
                ${isSelected
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                focus:outline-none focus:ring-2 focus:ring-primary/50
              `}
              onClick={() => handleChange(segmentValue)}
            >
              {segmentValue}
            </button>
          );
        })
      )}
    </div>
  );

  // Get the appropriate renderer
  const renderDisplay = () => {
    switch (display) {
      case 'emoji':
        return renderEmoji();
      case 'slider':
        return renderSlider();
      case 'labels':
        return renderLabels();
      case 'segments':
      default:
        return renderSegments();
    }
  };

  return (
    <div className="space-y-2">
      {/* Label row with value display */}
      <div className="flex items-center justify-between">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Value display */}
        {showValue && currentValue !== null && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {getLabelForValue(currentValue) || (
              <>
                {currentValue}
                <span className="text-gray-400">/{max}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Scale display */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Start label - fixed width for alignment */}
        {labelStart && (
          <span className={`text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 ${sizes.sideLabel} flex-shrink-0`}>
            {labelStart}
          </span>
        )}

        {/* Main display */}
        <div className="flex-1 min-w-0">
          {renderDisplay()}
        </div>

        {/* End label - fixed width for alignment */}
        {labelEnd && (
          <span className={`text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 ${sizes.sideLabel} flex-shrink-0 text-right`}>
            {labelEnd}
          </span>
        )}
      </div>

      {/* Help text */}
      {help && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{help}</p>
      )}

      {/* Error message */}
      {error && touched && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

ScaleInput.displayName = 'ScaleInput';
