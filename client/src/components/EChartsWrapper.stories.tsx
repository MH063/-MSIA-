import type { Meta, StoryObj } from '@storybook/react';
import EChartsWrapper from './EChartsWrapper';

const meta = {
  title: 'Components/EChartsWrapper',
  component: EChartsWrapper,
  tags: ['autodocs'],
  argTypes: {
    option: { control: 'object' },
    loading: { control: 'boolean' },
  },
} satisfies Meta<typeof EChartsWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LineChart: Story = {
  args: {
    option: {
      title: { text: 'Line Chart' },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      yAxis: { type: 'value' },
      series: [{ data: [150, 230, 224, 218, 135, 147, 260], type: 'line' }],
    },
    style: { height: '400px', width: '600px' },
  },
};

export const BarChart: Story = {
  args: {
    option: {
      title: { text: 'Bar Chart' },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      yAxis: { type: 'value' },
      series: [{ data: [120, 200, 150, 80, 70, 110, 130], type: 'bar' }],
    },
    style: { height: '400px', width: '600px' },
  },
};
