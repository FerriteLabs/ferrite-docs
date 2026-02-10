import React from 'react';
import Layout from '@theme/Layout';
import Playground from '@site/src/components/Playground';

export default function PlaygroundPage(): React.ReactElement {
  return (
    <Layout
      title="Try Ferrite — Interactive Playground"
      description="Try Ferrite commands in your browser - interactive playground for the high-performance key-value store"
    >
      <Playground />
    </Layout>
  );
}
