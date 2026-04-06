// src/components/FileUploader.jsx
import React from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function FileUploader({ onDataLoaded }) {
  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "csv") {
      parseCSV(file);
    } else if (extension === "xlsx" || extension === "xls") {
      parseExcel(file);
    } else {
      alert("Unsupported file type. Please upload CSV or Excel (.xlsx / .xls).");
    }
  }

  function parseCSV(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        onDataLoaded(results.data); // Array of objects
      },
    });
  }

  function parseExcel(file) {
    const reader = new FileReader();

    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      onDataLoaded(data);
    };

    reader.readAsBinaryString(file);
  }

  return (
    <div>
      <label
        style={{
          display: "inline-block",
          padding: "0.55rem 1rem",
          borderRadius: "0.5rem",
          background: "#0A2540",
          color: "#ffffff",
          fontSize: "0.9rem",
          cursor: "pointer",
        }}
      >
        Choose CSV / Excel
        <input
          type="file"
          accept=".csv, .xlsx, .xls"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}
