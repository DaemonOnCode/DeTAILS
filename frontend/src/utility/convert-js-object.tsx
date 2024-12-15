// Helper function to convert JSON to CSV
const convertToCSV = (data: Record<string, any>[]) => {
  if (!data || !data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((header) => `"${row[header] || ""}"`).join(","));
  return [headers.join(","), ...rows].join("\n");
};

export const saveCSV = async (renderer: any, data: Record<string, any>[], fileName = "data") => {
  const csvContent = convertToCSV(data); // Convert JSON data to CSV
  const result = await renderer.invoke("save-csv", { data: csvContent, fileName });

  if (result.success) {
    console.log("File saved:", result.filePath);
  } else {
    console.error("File save error:", result.message);
  }
};

export const saveExcel = async (renderer: any,data: Record<string,any>[], fileName = "data") => {
  const result = await renderer.invoke("save-excel", { data, fileName });

  if (result.success) {
    console.log("File saved:", result.filePath);
  } else {
    console.error("File save error:", result.message);
  }
};