# Structure du Projet Listmonk Alert

```
listmonk-alert/
│
├── 📋 Configuration & Documentation
│   ├── package.json                  # Dépendances et scripts NPM
│   ├── tsconfig.json                 # Configuration TypeScript
│   ├── eslint.config.mjs            # Configuration ESLint
│   ├── .env.example                 # Template configuration production
│   ├── .env.local.example           # Template configuration développement
│   ├── .gitignore                   # Fichiers ignorés par Git
│   ├── .dockerignore                # Fichiers ignorés par Docker
│   ├── Dockerfile                   # Build multi-stage optimisé
│   ├── README.md                    # Documentation principale
│   ├── QUICKSTART.md                # Guide démarrage rapide (5 min)
│   ├── DEPLOYMENT.md                # Guide déploiement complet
│   ├── IMPLEMENTATION.md            # Rapport d'implémentation
│   └── PROJECT_STRUCTURE.md         # Ce fichier
│
├── 📁 src/                          # Code source TypeScript
│   │
│   ├── index.ts                     # 🚀 Point d'entrée principal
│   │                                #    - Initialise tous les services
│   │                                #    - Gère graceful shutdown
│   │                                #    - Gestion erreurs globales
│   │
│   ├── 📁 config/                   # Configuration
│   │   ├── index.ts                 # Chargement et export configuration
│   │   └── validation.ts            # Schémas Zod de validation
│   │
│   ├── 📁 types/                    # Définitions TypeScript
│   │   ├── config.types.ts          # Types configuration
│   │   ├── database.types.ts        # Types tables Listmonk
│   │   └── notification.types.ts    # Types Google Chat
│   │
│   ├── 📁 utils/                    # Utilitaires
│   │   ├── logger.ts                # Logger Pino (dev/prod)
│   │   └── retry.ts                 # Retry avec backoff exponentiel
│   │
│   ├── 📁 services/                 # Services métier
│   │   │
│   │   ├── state.service.ts         # 💾 Gestion du watermark
│   │   │                            #    - Watermark en mémoire
│   │   │                            #    - Persistence JSON (/data/state.json)
│   │   │                            #    - Load/Update/Persist
│   │   │
│   │   ├── database.service.ts      # 🗄️ Accès PostgreSQL
│   │   │                            #    - Pool de connexions
│   │   │                            #    - getNewViews(afterId, limit)
│   │   │                            #    - Jointures (views + subscribers + campaigns)
│   │   │
│   │   ├── notifier.service.ts      # 💬 Notifications Google Chat
│   │   │                            #    - Format Google Chat Card V2
│   │   │                            #    - Envoi avec fetch()
│   │   │                            #    - Retry automatique
│   │   │
│   │   └── monitor.service.ts       # 🔄 Orchestration principale
│   │                                #    - Boucle de polling (5s)
│   │                                #    - Coordination DB + Notifier + State
│   │                                #    - Gestion erreurs
│   │
│   └── 📁 server/                   # Serveur HTTP
│       └── health.ts                # 🏥 Health check
│                                    #    - GET /health → status JSON
│                                    #    - GET / → redirect /health
│                                    #    - Port 3000
│
├── 📁 scripts/                      # Scripts utilitaires
│   └── test-connection.ts           # 🧪 Test configuration
│                                    #    - Valide variables env
│                                    #    - Test connexion PostgreSQL
│                                    #    - Affiche dernières vues
│                                    #    - Test webhook Google Chat
│
└── 📁 dist/                         # 🏗️ Code compilé (généré)
    └── [mirrors src/ structure]     # Fichiers .js + .d.ts + .map
```

## Flux de l'Application

### Au Démarrage

```
index.ts
  ↓
  ├─> config/index.ts (load + validate)
  │     ↓
  │     └─> config/validation.ts (Zod schemas)
  │
  ├─> services/state.service.ts (initialize watermark)
  │
  ├─> services/database.service.ts (connect PostgreSQL)
  │
  ├─> server/health.ts (start HTTP server :3000)
  │
  └─> services/monitor.service.ts (start polling loop)
```

### Boucle de Monitoring (toutes les 5s)

```
monitor.service.ts
  ↓
  ├─> state.service.ts → getWatermark()
  │
  ├─> database.service.ts → getNewViews(watermark, batchSize)
  │     ↓
  │     └─> PostgreSQL: SELECT campaign_views WHERE id > watermark
  │
  ├─> Pour chaque vue trouvée:
  │   │
  │   ├─> notifier.service.ts → sendNotification(data)
  │   │     ↓
  │   │     ├─> Format Google Chat Card V2
  │   │     │
  │   │     └─> fetch(webhookUrl) avec retry
  │   │           ↓
  │   │           └─> utils/retry.ts (backoff exponentiel)
  │   │
  │   └─> state.service.ts → updateWatermark(newId)
  │         ↓
  │         └─> Persist to /data/state.json
  │
  └─> Sleep(POLL_INTERVAL_MS)
```

### Au Shutdown (SIGTERM/SIGINT)

```
index.ts
  ↓
  ├─> monitor.service.ts → stop()
  ├─> state.service.ts → persistToFile()
  ├─> server/health.ts → stop()
  └─> database.service.ts → close()
```

## Scripts NPM Disponibles

```bash
# Développement
npm run dev              # Mode watch avec logs formatés
npm run type-check       # Vérifier les types TypeScript

# Production
npm run build            # Compiler TypeScript → dist/
npm start               # Lancer l'application compilée

# Tests
npm run test:connection  # Tester config et connexions

# Qualité
npm run lint            # Linter le code
```

## Variables d'Environnement

### Obligatoires

- `DB_HOST` - Hôte PostgreSQL
- `DB_PORT` - Port PostgreSQL
- `DB_NAME` - Base de données
- `DB_USER` - Utilisateur PostgreSQL
- `DB_PASSWORD` - Mot de passe
- `GOOGLE_CHAT_WEBHOOK_URL` - URL webhook

### Optionnelles (avec défauts)

- `NODE_ENV` (production)
- `LOG_LEVEL` (info)
- `HEALTH_CHECK_PORT` (3000)
- `DB_SSL` (true)
- `POLL_INTERVAL_MS` (5000)
- `BATCH_SIZE` (50)
- `INITIAL_WATERMARK` (0)
- `RETRY_MAX_ATTEMPTS` (3)
- `RETRY_DELAY_MS` (1000)
- `RETRY_BACKOFF_MULTIPLIER` (2)

## Fichiers de Persistence

```
/data/state.json         # Watermark persisté
```

Format :
```json
{
  "lastWatermark": 12345,
  "lastUpdated": "2026-01-29T14:35:00.000Z"
}
```

## Ports

- `3000` - Health check HTTP server

## Endpoints HTTP

- `GET /` → Redirect vers `/health`
- `GET /health` → Status JSON

Réponse `/health` :
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T14:35:00.000Z",
  "lastWatermark": 12345,
  "monitorRunning": true
}
```

## Dépendances

### Production (5)

- `pg` - Client PostgreSQL
- `pino` - Logger structuré
- `pino-pretty` - Formatage logs dev
- `zod` - Validation schemas
- `dotenv` - Variables d'environnement

### Development (6)

- `typescript` - Compilateur TS
- `tsx` - Exécuteur TypeScript
- `@types/node` - Types Node.js
- `@types/pg` - Types PostgreSQL
- `eslint` - Linter
- `@typescript-eslint/*` - ESLint pour TS

## Logs

### Format Production (JSON)

```json
{
  "level": "info",
  "time": "2026-01-29T14:35:00.000Z",
  "msg": "Found new email views",
  "count": 3,
  "watermark": 12345
}
```

### Format Développement (Pretty)

```
[14:35:00.000] INFO: Found new email views
  count: 3
  watermark: 12345
```

## Sizing

- **Image Docker** : ~150 MB (Alpine)
- **Mémoire Runtime** : ~50-100 MB
- **CPU** : Minimal (idle 99% du temps)
- **Stockage** : <1 MB (state.json)

## Sécurité

- ✅ User non-root dans Docker
- ✅ SSL PostgreSQL supporté
- ✅ Validation stricte Zod
- ✅ Pas de secrets dans le code
- ✅ Accès DB READ-ONLY recommandé

## Monitoring

### Logs à surveiller

- `error` - Erreurs critiques
- `warn` - Avertissements
- Compteur de vues traitées
- Délai entre détection et notification

### Métriques via /health

- `lastWatermark` - Progression
- `monitorRunning` - État du service
- `timestamp` - Dernier check

### Docker Health Check

Automatique, toutes les 30s :
```bash
curl http://localhost:3000/health
```

Si échec 3 fois → conteneur marqué "unhealthy"
