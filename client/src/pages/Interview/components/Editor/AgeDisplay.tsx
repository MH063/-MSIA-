import React from 'react';
import { Grid, Tag } from 'antd';
import { getAgeGroup, getResponsiveAgeDisplayText, normalizeAge, parseAgeText, type AgeDisplay } from '../../../../utils/age';

const { useBreakpoint } = Grid;

type AgeDisplayProps = {
  display?: AgeDisplay | null;
  years?: number | null;
  months?: number | null;
  text?: string | null;
  responsive?: boolean;
  showGroupTag?: boolean;
  className?: string;
};

const mergeClassName = (...xs: Array<string | null | undefined | false>): string =>
  xs.filter(Boolean).join(' ');

const renderStructured = (years: number, months: number, displayFormat: 'years' | 'months' | 'years_months'): React.ReactNode => {
  const age = normalizeAge({ years, months });

  if (displayFormat === 'months') {
    return (
      <>
        <span className="age-number">{age.totalMonths}</span>
        <span className="age-unit">个月</span>
      </>
    );
  }

  if (displayFormat === 'years') {
    return (
      <>
        <span className="age-number">{age.years}</span>
        <span className="age-unit">岁</span>
      </>
    );
  }

  return (
    <>
      <span className="age-number">{age.years}</span>
      <span className="age-unit">岁</span>
      {age.months > 0 ? <span className="age-months">{age.months}月</span> : null}
    </>
  );
};

const renderFromText = (text: string): React.ReactNode => {
  const parsed = parseAgeText(text);
  if (parsed) {
    return renderStructured(parsed.years, parsed.months, 'years_months');
  }
  return <span className="age-number">{text}</span>;
};

const AgeDisplayView: React.FC<AgeDisplayProps> = ({
  display,
  years,
  months,
  text,
  responsive = true,
  showGroupTag = false,
  className,
}) => {
  const screens = useBreakpoint();
  const width = screens.md ? 1024 : 375;

  const resolved = React.useMemo(() => {
    if (display) return display;
    if (typeof years === 'number' || typeof months === 'number') {
      const age = normalizeAge({ years: years ?? 0, months: months ?? 0 });
      return {
        mainText: `${age.years}岁${age.months > 0 ? `${age.months}月` : ''}`,
        yearsFloat: age.totalMonths / 12,
        totalDays: 0,
        totalMonthsInt: age.totalMonths,
        yearsPart: age.years,
        monthsPart: age.months,
        group: getAgeGroup({ years: age.years, months: age.months }),
      } satisfies AgeDisplay;
    }
    return null;
  }, [display, years, months]);

  if (!resolved && !text) return null;

  const group = resolved ? resolved.group : (text ? getAgeGroup(parseAgeText(text) ?? { years: 0, months: 0, totalMonths: 0 }) : getAgeGroup({ years: 0, months: 0 }));
  const mainText = resolved ? resolved.mainText : String(text ?? '');

  const displayText = resolved && responsive && resolved.totalMonthsInt >= 1
    ? getResponsiveAgeDisplayText({ years: resolved.yearsPart, months: resolved.monthsPart }, width)
    : mainText;

  return (
    <span className={mergeClassName('age-display', group.cssClass, className)}>
      {resolved
        ? renderFromText(displayText)
        : renderFromText(displayText)}
      {showGroupTag ? (
        <Tag color="default" style={{ marginLeft: 8, fontSize: 12, lineHeight: '18px' }}>
          {group.label}
        </Tag>
      ) : null}
    </span>
  );
};

export default AgeDisplayView;
