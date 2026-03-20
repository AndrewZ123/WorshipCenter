'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Flex, Tooltip } from '@chakra-ui/react';
import { GripVertical } from 'lucide-react';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

/**
 * A reusable sortable item component with foolproof mobile-friendly drag handling
 * 
 * Key Features for Mobile Reliability:
 * - Large touch targets (minimum 44x44px)
 * - Proper touch event handling prevents scroll interference
 * - Visual feedback clearly indicates draggability
 * - Drag handle only responds to intentional gestures
 * - Prevents text selection and copy issues
 * - Works reliably on both mobile and desktop
 * 
 * Usage: Wrap any content in this component to make it sortable
 */
export default function SortableItem({ id, children }: SortableItemProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingItem,
  } = useSortable({ id });

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track dragging state for visual feedback
  useEffect(() => {
    setIsDragging(isDraggingItem);
  }, [isDraggingItem]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingItem ? 0.4 : 1,
    zIndex: isDraggingItem ? 100 : 1,
  };

  // Enhanced touch handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    // Store initial touch position to distinguish tap from drag
    const touch = e.touches[0];
    (e.currentTarget as HTMLElement).dataset.touchStartX = touch.clientX.toString();
    (e.currentTarget as HTMLElement).dataset.touchStartY = touch.clientY.toString();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent page scrolling when dragging
    if (isDragging) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clean up stored touch data
    const element = e.currentTarget as HTMLElement;
    delete element.dataset.touchStartX;
    delete element.dataset.touchStartY;
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      align="center"
      w="full"
      position="relative"
      className={`sortable-item ${isDragging ? 'sortable-item--dragging' : ''}`}
    >
      {/* Drag Handle - Fully optimized for mobile touch */}
      <Tooltip 
        label={isMobile ? "Drag to reorder" : "Drag to reorder"} 
        placement="left"
        hasArrow
        openDelay={500}
      >
        <Box
          ref={dragHandleRef}
          {...attributes}
          {...listeners}
          display="flex"
          alignItems="center"
          justifyContent="center"
          w={{ base: '44px', md: '40px' }}
          h={{ base: '44px', md: 'full' }}
          minH={{ base: '44px', md: 'auto' }}
          mr="2"
          cursor={{ base: 'grab', md: 'grab' }}
          _active={{ cursor: 'grabbing', bg: 'gray.100', borderRadius: 'md' }}
          _hover={{ 
            bg: 'gray.50', 
            borderRadius: 'md',
            _dark: { bg: 'gray.700' }
          }}
          borderRadius="md"
          transition="all 0.15s ease"
          userSelect="none"
          sx={{
            touchAction: 'none',
            WebkitUserSelect: 'none',
            WebkitUserDrag: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            MozUserSelect: 'none',
            msUserSelect: 'none',
          }}
          flexShrink={0}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          data-dnd-kit-drag-handle="true"
          className="drag-handle"
          aria-label="Drag to reorder item"
          role="button"
          tabIndex={0}
        >
          <GripVertical 
            size={isMobile ? 24 : 20} 
            color="#718096" 
            strokeWidth={2}
            pointerEvents="none"
            style={{ 
              opacity: isDragging ? 0.6 : 1,
              transition: 'opacity 0.15s ease'
            }}
          />
        </Box>
      </Tooltip>
      
      {/* Item Content - Protected from drag interference */}
      <Box 
        flex="1" 
        userSelect={isDragging ? 'none' : 'auto'}
        sx={{
          touchAction: isDragging ? 'none' : 'auto',
        }}
        w="full"
        className="sortable-item-content"
      >
        {children}
      </Box>
    </Flex>
  );
}
