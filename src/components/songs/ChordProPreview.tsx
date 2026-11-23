'use client';

import React from 'react';
import { Box, Text } from '@chakra-ui/react';

/**
 * Shared ChordPro renderer used by the song viewer and editor previews.
 * Parses [G]Amazing [C]Grace-style chords and floats them above the lyrics.
 */
export default function ChordProPreview({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, lineIdx) => {
        if (line.startsWith('{') && line.endsWith('}')) {
          const directive = line.slice(1, -1);
          if (directive.startsWith('title:') || directive.startsWith('t:')) {
            return (
              <Text key={lineIdx} fontWeight="700" fontSize="lg" mb="1">
                {directive.split(':').slice(1).join(':').trim()}
              </Text>
            );
          }
          if (directive.startsWith('subtitle:') || directive.startsWith('st:')) {
            return (
              <Text key={lineIdx} color="gray.500" fontSize="sm" mb="2">
                {directive.split(':').slice(1).join(':').trim()}
              </Text>
            );
          }
          if (directive.startsWith('comment:') || directive.startsWith('c:')) {
            return (
              <Text key={lineIdx} color="teal.600" fontWeight="600" fontSize="sm" mt="3" mb="1">
                {directive.split(':').slice(1).join(':').trim()}
              </Text>
            );
          }
          return null;
        }

        const parts: React.ReactNode[] = [];
        let remaining = line;
        let partIdx = 0;

        while (remaining) {
          const match = remaining.match(/\[([^\]]+)\]/);
          if (!match) {
            parts.push(
              <Text as="span" key={partIdx}>
                {remaining}
              </Text>
            );
            break;
          }
          const before = remaining.slice(0, match.index);
          if (before) {
            parts.push(
              <Text as="span" key={partIdx++}>
                {before}
              </Text>
            );
          }
          parts.push(
            <Text as="span" key={partIdx++} position="relative" display="inline-block">
              <Text
                as="span"
                position="absolute"
                top="-1.2em"
                left="0"
                fontSize="xs"
                fontWeight="700"
                color="teal.600"
              >
                {match[1]}
              </Text>
            </Text>
          );
          remaining = remaining.slice((match.index || 0) + match[0].length);
        }

        return (
          <Box
            key={lineIdx}
            lineHeight="2.4"
            fontFamily="'Courier New', monospace"
            fontSize="sm"
            whiteSpace="pre-wrap"
          >
            {parts.length > 0 ? parts : '\u00A0'}
          </Box>
        );
      })}
    </>
  );
}
