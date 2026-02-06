import type { Meta, StoryObj } from '@storybook/react';
import ChatBubble from './ChatBubble';
import dayjs from 'dayjs';

const meta = {
  title: 'Interview/ChatBubble',
  component: ChatBubble,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    message: { control: 'object' },
  },
} satisfies Meta<typeof ChatBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

const now = dayjs().valueOf();

export const UserText: Story = {
  args: {
    message: {
      id: '1',
      role: 'user',
      content: 'Hello, I have a headache.',
      type: 'text',
      timestamp: now,
      status: 'sent',
    },
  },
};

export const AssistantText: Story = {
  args: {
    message: {
      id: '2',
      role: 'assistant',
      content: 'Could you describe the location of the pain?',
      type: 'text',
      timestamp: now,
    },
  },
};

export const UserVoice: Story = {
  args: {
    message: {
      id: '3',
      role: 'user',
      content: 'Audio message',
      type: 'voice',
      timestamp: now,
      status: 'sent',
      metadata: {
        voiceDuration: 12,
      },
    },
  },
};

export const UserImage: Story = {
  args: {
    message: {
      id: '4',
      role: 'user',
      content: 'Image message',
      type: 'image',
      timestamp: now,
      status: 'sent',
      metadata: {
        imageUrl: 'https://picsum.photos/200/300',
      },
    },
  },
};
