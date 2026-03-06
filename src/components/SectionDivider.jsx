export default function SectionDivider({ label }) {
  return (
    <div className="section-div">
      <span className="section-div-label">{label}</span>
      <div className="section-div-line" />
    </div>
  );
}
