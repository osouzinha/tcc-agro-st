import React from 'react';

export function Card({ titulo, valor, unidade, icone, cor = "blue" }) {
  // Lógica para definir cores baseado na props 'cor'
  const estiloBorda = cor === "red" ? "4px solid #D32F2F" : "4px solid #2196F3";
  const corTexto = cor === "red" ? "#D32F2F" : "#1976D2";

  return (
    <div style={{ 
      background: "white", 
      borderRadius: "12px", 
      padding: "20px", 
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      borderLeft: estiloBorda,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#546e7a", fontWeight: "bold", textTransform: "uppercase", fontSize: "12px" }}>
        {icone}
        <span>{titulo}</span>
      </div>
      
      <div style={{ fontSize: "36px", fontWeight: "800", color: corTexto, margin: "10px 0" }}>
        {valor}
      </div>
      
      <div style={{ color: "#90a4ae", fontSize: "14px" }}>
        {unidade}
      </div>
    </div>
  );
}