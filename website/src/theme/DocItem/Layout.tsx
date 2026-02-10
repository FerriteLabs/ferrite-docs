import React from 'react';
import Layout from '@theme-original/DocItem/Layout';
import type LayoutType from '@theme/DocItem/Layout';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import MaturityBadge from '@site/src/components/MaturityBadge';

type Props = React.ComponentProps<typeof LayoutType>;

export default function LayoutWrapper(props: Props): JSX.Element {
  const {frontMatter} = useDoc();
  const maturity = frontMatter.maturity as
    | 'stable'
    | 'beta'
    | 'experimental'
    | undefined;

  return (
    <>
      {maturity && <MaturityBadge level={maturity} />}
      <Layout {...props} />
    </>
  );
}
