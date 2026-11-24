'use client';

import React from 'react';
import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { splitChordProLine } from '@/lib/chordpro';

/**
 * Shared ChordPro renderer used by the song viewer and editor previews.
 * Parses [G]Amazing [C]Grace-style chords and lays them above the lyrics
 * without overlapping the first letters.
 */
export default function ChordProPreview({ text }: { text: string }) {
  const chordColor = useColorModeValue('teal.600', 'teal.300');
  const commentColor = useColorModeValue('teal.700', 'teal.200');
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
              <Text key={lineIdx} color={commentColor} fontWeight="600" fontSize="sm" mt="3" mb="1">
                {directive.split(':').slice(1).join(':').trim()}
              </Text>
            );
          }
          return null;
        }

        const segments = splitChordProLine(line);

        return (
          <Flex
            key={lineIdx}
            wrap="wrap"
            align="flex-start"
            fontFamily="'Courier New', monospace"
            fontSize="sm"
            mb="1"
          >
            {segments.length === 0 ? (
              <Box minH="1.2em">&nbsp;</Box>
            ) : (
              segments.map((segment, segmentIdx) => {
                // A chord with no lyric after it still needs a gap so two
                // adjacent chords do not sit flush against each other.
                const chordLabel = segment.chord
                  ? segment.lyric
                    ? segment.chord
                    : `${segment.chord} `
                  : '';

                return (
                  <Box
                    as="span"
                    key={segmentIdx}
                    display="inline-flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    whiteSpace="pre"
                  >
                    <Text
                      as="span"
                      fontSize="0.9em"
                      fontWeight="700"
                      lineHeight="1.2"
                      minH="1.2em"
                      color={chordColor}
                      whiteSpace="pre"
                    >
                      {chordLabel || '\u00A0'}
                    </Text>
                    <Text as="span" lineHeight="1.3" minH="1.3em" whiteSpace="pre">
                      {segment.lyric || '\u00A0'}
                    </Text>
                  </Box>
                );
              })
            )}
          </Flex>
        );
      })}
    </>
  );
}
