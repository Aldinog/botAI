-- Tabel untuk melacak status scan per emiten per jam
CREATE TABLE scan_state (
  symbol TEXT PRIMARY KEY,
  last_scanned_at TIMESTAMPTZ,
  last_signal_action TEXT, -- BUY / SELL / WAIT
  last_signal_reason TEXT,
  last_signal_sent_at TIMESTAMPTZ
);

-- Tabel untuk daftar saham yang ingin dipantau
CREATE TABLE monitor_symbols (
  symbol TEXT PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert contoh data
INSERT INTO monitor_symbols (symbol) VALUES 
('BBCA.JK'), ('BBRI.JK'), ('TLKM.JK'), ('ASII.JK'), ('GOTO.JK'),
('BMRI.JK'), ('BBNI.JK'), ('ADRO.JK'), ('UNTR.JK'), ('PGAS.JK');
