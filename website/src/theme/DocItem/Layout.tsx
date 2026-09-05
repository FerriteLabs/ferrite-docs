import React from 'react';
import Layout from '@theme-original/DocItem/Layout';
import type LayoutType from '@theme/DocItem/Layout';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import MaturityBadge from '@site/src/components/MaturityBadge';

type Props = React.ComponentProps<typeof LayoutType>;
type MaturityLevel = 'stable' | 'beta' | 'experimental';

function isMaturityLevel(value: unknown): value is MaturityLevel {
  return value === 'stable' || value === 'beta' || value === 'experimental';
}

export default function LayoutWrapper(props: Props): React.ReactNode {
  const {frontMatter} = useDoc();
  const maturityValue = Reflect.get(frontMatter, 'maturity');
  const maturity = isMaturityLevel(maturityValue) ? maturityValue : undefined;

  return (
    <>
      {maturity && <MaturityBadge level={maturity} />}
      <Layout {...props} />
    </>
  );
}
