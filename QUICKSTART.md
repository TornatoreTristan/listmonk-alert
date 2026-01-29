# Démarrage Rapide - Listmonk Alert

Guide de démarrage en 5 minutes.

## 1. Installation

```bash
npm install
```

## 2. Configuration

### Créer le fichier .env

```bash
cp .env.example .env
```

### Éditer .env avec vos valeurs

Valeurs minimales requises :

```bash
# PostgreSQL Listmonk
DB_HOST=votre-serveur-postgres.com
DB_PORT=5432
DB_NAME=listmonk
DB_USER=listmonk_readonly
DB_PASSWORD=votre_mot_de_passe

# Google Chat Webhook
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/xxx/messages?key=xxx&token=xxx

# Important: Pour éviter le spam au premier lancement
INITIAL_WATERMARK=0
```

## 3. Créer un utilisateur PostgreSQL en lecture seule

```sql
-- Se connecter à PostgreSQL en tant que superuser
psql -U postgres -d listmonk

-- Créer l'utilisateur
CREATE USER listmonk_readonly WITH PASSWORD 'votre_mot_de_passe_securise';
GRANT CONNECT ON DATABASE listmonk TO listmonk_readonly;
GRANT USAGE ON SCHEMA public TO listmonk_readonly;
GRANT SELECT ON campaign_views, subscribers, campaigns TO listmonk_readonly;
```

## 4. Créer un webhook Google Chat

1. Ouvrir Google Chat → Sélectionner votre espace
2. Cliquer sur le nom de l'espace → **Apps & integrations**
3. **Add webhooks**
4. Nom: "Listmonk Alert" → **Save**
5. Copier l'URL et la mettre dans `GOOGLE_CHAT_WEBHOOK_URL`

## 5. Tester la configuration

```bash
npm run test:connection
```

✅ Si tout est OK, vous verrez :
- Connexion PostgreSQL réussie
- Liste des dernières vues
- Message test dans Google Chat

💡 **Conseil** : Le script vous donnera le dernier ID. Mettez-le dans `INITIAL_WATERMARK` pour éviter de recevoir toutes les notifications historiques.

## 6. Lancer l'application

### Mode développement (avec logs formatés)

```bash
npm run dev
```

### Mode production

```bash
npm run build
npm start
```

## 7. Vérifier que ça fonctionne

### Health check

```bash
curl http://localhost:3000/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T14:35:00.000Z",
  "lastWatermark": 12345,
  "monitorRunning": true
}
```

### Tester avec un vrai email

1. Envoyer une campagne test depuis Listmonk
2. Ouvrir l'email (dans un vrai client email ou webmail)
3. Attendre 5-10 secondes
4. Vous devriez recevoir une notification dans Google Chat !

## 8. Déploiement Docker (optionnel)

```bash
# Build
docker build -t listmonk-alert .

# Run
docker run -d \
  --name listmonk-alert \
  --env-file .env \
  -p 3000:3000 \
  -v listmonk-alert-data:/data \
  listmonk-alert

# Logs
docker logs -f listmonk-alert
```

## Troubleshooting

### Trop de notifications au démarrage

→ Mettez `INITIAL_WATERMARK` au dernier ID (visible avec `npm run test:connection`)

### Erreur de connexion PostgreSQL

→ Vérifiez `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`

### Pas de notifications

→ Vérifiez les logs : `docker logs -f listmonk-alert` ou dans la console en mode dev

### Webhook Google Chat invalide

→ Vérifiez que l'URL est complète et valide avec `npm run test:connection`

## Configuration Coolify

1. Créer app → Type: **Dockerfile**
2. Ajouter toutes les variables d'environnement
3. Health check: Path `/health`, Port `3000`
4. Déployer

## Support

Voir [README.md](./README.md) pour la documentation complète.
