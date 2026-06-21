// dashboard/page.tsx
// DELIBERATELY BROKEN: Missing auth check, missing states, default export, 'any' types

export default function Dashboard({ data }: { data: any }) {
  // TODO: add auth check here
  // FIXME: load data from API

  return (
    <div>
      <h1>Dashboard</h1>
      <div>{data.map((item: any) => <div key={item.id}>{item.name}</div>)}</div>
    </div>
  );
}
