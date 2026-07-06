'use client';

import { Text, Box, Image, Link } from '@chakra-ui/react';

// Simple regex-based markdown-like text renderer
// Supports: **bold**, *italic*, ~~strikethrough~~, `code`, ![gif](url), ![image](url), links

interface MarkdownRendererProps {
  content: string;
  color?: string;
}

function parseInline(text: string): (string | { type: string; content?: string; url?: string })[] {
  const parts: (string | { type: string; content?: string; url?: string })[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~~(.+?)~~)|(`(.+?)`)|(!\[(gif|image)\]\((.+?)\))|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push({ type: 'bold', content: match[2] });
    } else if (match[4]) {
      parts.push({ type: 'italic', content: match[4] });
    } else if (match[6]) {
      parts.push({ type: 'strikethrough', content: match[6] });
    } else if (match[8]) {
      parts.push({ type: 'code', content: match[8] });
    } else if (match[10]) {
      parts.push({ type: match[10] as 'gif' | 'image', url: match[11] });
    } else if (match[13]) {
      parts.push({ type: 'link', content: match[13], url: match[14] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function MarkdownRenderer({ content, color }: MarkdownRendererProps) {
  const parts = parseInline(content);

  return (
    <Text fontSize="sm" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word" color={color}>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{part}</span>;
        }
        switch (part.type) {
          case 'bold':
            return <strong key={i}>{part.content}</strong>;
          case 'italic':
            return <em key={i}>{part.content}</em>;
          case 'strikethrough':
            return <del key={i}>{part.content}</del>;
          case 'code':
            return (
              <Box as="code" px="1" py="0.5" bg="gray.100" borderRadius="sm" fontSize="xs" fontFamily="mono" key={i}>
                {part.content}
              </Box>
            );
          case 'gif':
          case 'image':
            return (
              <Image
                key={i}
                src={part.url}
                alt=""
                maxW="300px"
                maxH="200px"
                borderRadius="md"
                my="1"
                objectFit="cover"
                fallback={<Box w="200px" h="120px" bg="gray.100" borderRadius="md" />}
              />
            );
          case 'link':
            return (
              <Link key={i} href={part.url} color="teal.500" isExternal fontSize="sm">
                {part.content}
              </Link>
            );
          default:
            return null;
        }
      })}
    </Text>
  );
}
