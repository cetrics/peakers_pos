import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { FaTimes, FaFileCsv, FaFileExcel, FaFilePdf } from "react-icons/fa";
import "./styles/SupplierPaymentHistoryModal.css";

const SupplierPaymentHistoryModal = ({
  supplierId,
  supplierProductId,
  productName, // Add this prop
  onClose,
}) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [supplierInfo, setSupplierInfo] = useState({});

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await axios.get(
        `/supplier-payments/${supplierId}/${supplierProductId}`
      );

      const data = response.data || {};
      setPayments(data.payments || []);
      setTotalPaid(data.total_paid || 0);
      setRemainingAmount(data.balance_remaining || 0);
      setSupplierInfo(data.supplier_info || {});
      setLoading(false);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      setLoading(false);
    }
  };

  // Helper function to create a safe filename
  const createSafeFilename = (name) => {
    return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  };

  // Download CSV Report
  const downloadCSV = () => {
    const safeProductName = productName
      ? createSafeFilename(productName)
      : `product_${supplierProductId}`;

    const headers = [
      "Payment ID",
      "Date",
      "Amount (KES)",
      "Payment Method",
      "Reference",
    ];

    const data = payments.map((payment) => [
      payment.payment_id,
      new Date(payment.payment_date).toLocaleDateString(),
      payment.amount,
      payment.payment_method,
      payment.reference || "N/A",
    ]);

    // Add summary rows
    data.push([""]);
    data.push(["Total Paid", "", `KSh ${totalPaid}`]);
    data.push(["Remaining Balance", "", `KSh ${remainingAmount}`]);

    let csvContent = headers.join(",") + "\n";
    data.forEach((row) => (csvContent += row.join(",") + "\n"));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `payment_history_${safeProductName}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
  };

  // Download Excel Report
  const downloadExcel = () => {
    const safeProductName = productName
      ? createSafeFilename(productName)
      : `product_${supplierProductId}`;

    const paymentData = payments.map((payment) => ({
      "Payment ID": payment.payment_id,
      Date: new Date(payment.payment_date).toLocaleDateString(),
      "Amount (KES)": payment.amount,
      "Payment Method": payment.payment_method,
      Reference: payment.reference || "N/A",
    }));

    // Add summary data
    const summaryData = [
      {
        "Payment ID": "SUMMARY",
        Date: "",
        "Amount (KES)": "",
        "Payment Method": "",
        Reference: "",
      },
      {
        "Payment ID": "Total Paid",
        Date: "",
        "Amount (KES)": totalPaid,
        "Payment Method": "",
        Reference: "",
      },
      {
        "Payment ID": "Remaining Balance",
        Date: "",
        "Amount (KES)": remainingAmount,
        "Payment Method": "",
        Reference: "",
      },
    ];

    const data = [...paymentData, ...summaryData];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payment History");
    XLSX.writeFile(
      workbook,
      `payment_history_${safeProductName}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  // Download PDF Report
  const downloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const safeProductName = productName
        ? createSafeFilename(productName)
        : `product_${supplierProductId}`;

      const doc = new jsPDF();

      // Title and Date
      doc.setFontSize(16);
      doc.text(
        `Payment History for ${productName || `Product ${supplierProductId}`}`,
        14,
        15
      );
      doc.setFontSize(10);
      doc.text(
        `Supplier: ${supplierInfo.supplier_name || `Supplier ${supplierId}`}`,
        14,
        22
      );
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 29);

      // Main table data
      const headers = [
        ["Payment ID", "Date", "Amount (KES)", "Payment Method", "Reference"],
      ];

      const data = payments.map((payment) => [
        payment.payment_id,
        new Date(payment.payment_date).toLocaleDateString(),
        payment.amount,
        payment.payment_method,
        payment.reference || "N/A",
      ]);

      // Generate main table
      doc.autoTable({
        head: headers,
        body: data,
        startY: 35,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
        },
        headStyles: {
          fillColor: [61, 128, 133],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          2: { halign: "right" },
        },
      });

      // Add summary
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.text(`Total Paid: KSh ${totalPaid}`, 14, finalY);
      doc.text(`Remaining Balance: KSh ${remainingAmount}`, 14, finalY + 7);

      doc.save(
        `payment_history_${safeProductName}_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <div className="supplier-payment-history-modal">
      <div className="modal-content">
        {/* Header with Close Button */}
        <div className="modal-header">
          <button className="close-btnn" onClick={onClose}>
            <FaTimes />
          </button>
          <h2>
            Payment History for {productName || `Product ${supplierProductId}`}
          </h2>
          <div className="report-buttons">
            <button className="report-button" onClick={downloadCSV}>
              <i
                className="fas fa-file-csv report-icon"
                style={{ color: "#217346" }}
              ></i>
              Download CSV
            </button>
            <button className="report-button" onClick={downloadExcel}>
              <i
                className="fas fa-file-excel report-icon"
                style={{ color: "#217346" }}
              ></i>
              Download Excel
            </button>
            <button className="report-button" onClick={downloadPDF}>
              <i
                className="fas fa-file-pdf report-icon"
                style={{ color: "#d24726" }}
              ></i>
              Download PDF
            </button>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="modal-body">
          {loading ? (
            <p>Loading...</p>
          ) : payments.length > 0 ? (
            <>
              <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                      <td>KSh {payment.amount}</td>
                      <td>{payment.payment_method}</td>
                      <td>{payment.reference || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Balance Section */}
              <div className="balance-section">
                <strong>Total Balance Paid:</strong> KSh {totalPaid} <br />
                <strong>Remaining Amount to be Paid:</strong>
                <span style={{ color: remainingAmount > 0 ? "red" : "green" }}>
                  KSh {remainingAmount}
                </span>
              </div>
            </>
          ) : (
            <p>No payments found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPaymentHistoryModal;
