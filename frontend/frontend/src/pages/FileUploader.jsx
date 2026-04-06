import * as XLSX from "xlsx";

export default function FileUploader({ onPreview }) {

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    window.selectedFile = file; // quick fix (later we improve)

    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      onPreview(json.slice(0, 5));
    };

    reader.readAsArrayBuffer(file);
  }

  return (
    <div style={uploadBox}>
      <label style={uploadLabel}>
        Choose Excel File
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}