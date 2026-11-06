-- NULL preserva pedidos antigos; pedidos novos exigem uma escolha na aplicação.
ALTER TABLE pedidos ADD COLUMN canal_indicacao ENUM('maps', 'whatsapp', 'both') NULL;
ALTER TABLE indicacoes ADD COLUMN whatsapp_numero VARCHAR(15) NULL;
