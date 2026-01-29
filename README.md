# Listmonk Alert

Application Node.js + TypeScript qui surveille en temps réel les ouvertures d'emails dans Listmonk et envoie des notifications Google Chat.

## Fonctionnalités

- 📊 Surveillance en temps réel des ouvertures d'emails Listmonk
- 💬 Notifications instantanées via Google Chat
- 🔄 Système de retry avec backoff exponentiel
- 💾 Persistence du watermark pour survivre aux redémarrages
- 🏥 Health check intégré pour monitoring
- 🐳 Prêt pour Docker et Coolify

## Architecture

**Stratégie** : Polling PostgreSQL toutes les 5 secondes avec système de watermark

```
PostgreSQL (Listmonk) → Polling → Détection nouvelles vues → Google Chat
```

**Latence** : 5-10 secondes entre l'ouverture d'un email et la notification

## Prérequis

- Node.js 20+
- Accès à la base de données PostgreSQL de Listmonk (lecture seule recommandé)
- Webhook Google Chat

## Installation

### 1. Cloner et installer les dépendances

```bash
git clone <repository-url>
cd listmonk-alert
npm install
```

### 2. Créer un utilisateur PostgreSQL en lecture seule (recommandé)

```sql
CREATE USER listmonk_readonly WITH PASSWORD 'your_secure_password';
GRANT CONNECT ON DATABASE listmonk TO listmonk_readonly;
GRANT USAGE ON SCHEMA public TO listmonk_readonly;
GRANT SELECT ON campaign_views, subscribers, campaigns TO listmonk_readonly;
```

### 3. Créer un webhook Google Chat

1. Ouvrir Google Chat et sélectionner l'espace où vous voulez recevoir les notifications
2. Cliquer sur le nom de l'espace → **Apps & integrations**
3. Cliquer sur **Add webhooks**
4. Donner un nom (ex: "Listmonk Alert") et optionnellement une icône
5. Copier l'URL du webhook

### 4. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

**Variables obligatoires** :
- `DB_HOST` : Hôte PostgreSQL
- `DB_PORT` : Port PostgreSQL (5432 par défaut)
- `DB_NAME` : Nom de la base Listmonk
- `DB_USER` : Utilisateur PostgreSQL
- `DB_PASSWORD` : Mot de passe PostgreSQL
- `GOOGLE_CHAT_WEBHOOK_URL` : URL du webhook Google Chat

**Variables optionnelles** :
- `POLL_INTERVAL_MS` : Intervalle de polling en ms (5000 par défaut)
- `BATCH_SIZE` : Nombre max de vues à traiter par cycle (50 par défaut)
- `INITIAL_WATERMARK` : ID de départ (0 par défaut, mettre au dernier ID pour éviter spam)
- `LOG_LEVEL` : Niveau de log (info par défaut)

### 5. Tester la configuration

```bash
npm run test:connection
```

Ce script va :
- Valider les variables d'environnement
- Tester la connexion PostgreSQL
- Afficher les dernières vues d'emails
- Envoyer un message test à Google Chat

Si tout fonctionne, vous verrez un message de test dans votre espace Google Chat.

## Utilisation

### Mode développement

```bash
npm run dev
```

Mode watch avec rechargement automatique et logs formatés.

### Mode production

```bash
npm run build
npm start
```

### Docker

#### Build et run local

```bash
docker build -t listmonk-alert .
docker run -d \
  --name listmonk-alert \
  --env-file .env \
  -p 3000:3000 \
  -v listmonk-alert-data:/data \
  listmonk-alert
```

#### Vérifier les logs

```bash
docker logs -f listmonk-alert
```

#### Health check

```bash
curl http://localhost:3000/health
```

Réponse :
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T14:35:00.000Z",
  "lastWatermark": 12345,
  "monitorRunning": true
}
```

## Déploiement Coolify

### 1. Créer l'application

1. Dans Coolify, créer une nouvelle application
2. Choisir **Dockerfile** comme type
3. Connecter votre repository Git
4. Configurer la branche (main/master)

### 2. Variables d'environnement

Ajouter toutes les variables depuis `.env.example` dans l'interface Coolify.

### 3. Health check

Configurer le health check :
- **Path** : `/health`
- **Port** : `3000`
- **Interval** : `30s`

### 4. Volumes persistants (optionnel)

Pour persister le watermark entre redéploiements :
- Monter un volume sur `/data`

### 5. Déployer

Lancer le déploiement et surveiller les logs.

## Structure du Projet

```
listmonk-alert/
├── src/
│   ├── config/              # Configuration et validation Zod
│   ├── services/            # Services métier (DB, Notifier, Monitor, State)
│   ├── types/               # Définitions TypeScript
│   ├── utils/               # Utilitaires (logger, retry)
│   ├── server/              # Serveur health check
│   └── index.ts             # Point d'entrée
├── scripts/
│   └── test-connection.ts   # Script de test
├── Dockerfile               # Build multi-stage optimisé
├── .env.example             # Template configuration
└── README.md
```

## Monitoring et Logs

### Logs

En développement : logs formatés avec couleurs (pino-pretty)
En production : logs JSON pour parsing

**Niveaux de log** :
- `error` : Erreurs critiques
- `warn` : Avertissements
- `info` : Informations importantes (par défaut)
- `debug` : Détails de debug

### Métriques clés

Le health check expose :
- `lastWatermark` : Dernier ID traité
- `monitorRunning` : État du service de monitoring
- `timestamp` : Horodatage du check

## Sécurité

- ✅ Utilisateur PostgreSQL en lecture seule recommandé
- ✅ Variables d'environnement non commitées
- ✅ Conteneur Docker non-root
- ✅ Validation stricte avec Zod
- ✅ Pas de modification de la base Listmonk

## Troubleshooting

### Les notifications ne sont pas envoyées

1. Vérifier les logs : `docker logs listmonk-alert`
2. Tester le webhook : `npm run test:connection`
3. Vérifier que le watermark avance : `curl localhost:3000/health`

### Trop de notifications au démarrage

Si vous avez beaucoup de vues historiques, vous allez recevoir toutes les notifications depuis `INITIAL_WATERMARK=0`.

**Solution** : Avant le premier lancement, lancez `npm run test:connection` qui vous donnera le dernier ID. Mettez ce ID dans `INITIAL_WATERMARK`.

### Erreur de connexion PostgreSQL

- Vérifier que le serveur PostgreSQL est accessible
- Vérifier les credentials
- Vérifier que l'utilisateur a les permissions SELECT sur les tables nécessaires

### Erreur webhook Google Chat

- Vérifier que l'URL du webhook est correcte et complète
- Vérifier que le webhook n'a pas été révoqué dans Google Chat
- Tester avec `npm run test:connection`

## Performance

- **Latence** : 5-10 secondes entre ouverture et notification
- **Charge DB** : 1 requête toutes les 5 secondes (négligeable)
- **Ressources** : ~50-100 MB RAM, CPU minimal

## Améliorations Futures

- [ ] Support multi-webhooks (Slack, Discord, Telegram)
- [ ] Filtres par campagne
- [ ] Dashboard de statistiques
- [ ] Métriques Prometheus
- [ ] Persistence watermark en PostgreSQL pour HA

## Licence

MIT

## Support

Pour les bugs et feature requests, ouvrir une issue sur GitHub.
