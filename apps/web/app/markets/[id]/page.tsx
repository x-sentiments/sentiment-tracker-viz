interface Props {
  params: { id: string };
}

export default function MarketDetailPage({ params }: Props) {
  return (
    <main style={{ padding: "24px" }}>
      <h1>Market {params.id}</h1>
      <p>Detail view placeholder: outcome cards, chart, curated posts to come.</p>
    </main>
  );
}

