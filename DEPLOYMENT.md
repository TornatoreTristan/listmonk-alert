# Guide de Déploiement - Listmonk Alert

## Déploiement avec Coolify

### Prérequis

1. Un serveur Coolify configuré
2. Accès à la base PostgreSQL de Listmonk (depuis le serveur Coolify)
3. Un webhook Google Chat créé

### Étape 1 : Préparer le Repository

1. Initialiser Git (si pas déjà fait)

```bash
git init
git add .
git commit -m "Initial commit - Listmonk Alert"
```

2. Pusher vers GitHub/GitLab

```bash
git remote add origin <votre-repo-url>
git branch -M main
git push -u origin main
```

### Étape 2 : Créer l'Application dans Coolify

1. Se connecter à Coolify
2. Sélectionner votre serveur/projet
3. Cliquer sur **+ New Resource** → **Application**
4. Choisir **Public Repository** (ou Private si votre repo est privé)
5. Coller l'URL du repository
6. **Build Pack** : Sélectionner **Dockerfile**
7. **Branch** : `main`
8. Donner un nom : `listmonk-alert`

### Étape 3 : Configuration

#### Variables d'environnement

Dans l'onglet **Environment Variables**, ajouter :

```bash
# Application
NODE_ENV=production
LOG_LEVEL=info
HEALTH_CHECK_PORT=3000

# PostgreSQL Listmonk
DB_HOST=postgres.votre-serveur.com
DB_PORT=5432
DB_NAME=listmonk
DB_USER=listmonk_readonly
DB_PASSWORD=votre_mot_de_passe_securise
DB_SSL=true

# Google Chat
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/xxx/messages?key=xxx&token=xxx

# Monitoring
POLL_INTERVAL_MS=5000
BATCH_SIZE=50
INITIAL_WATERMARK=0

# Retry
RETRY_MAX_ATTEMPTS=3
RETRY_DELAY_MS=1000
RETRY_BACKOFF_MULTIPLIER=2
```

**Important** : Déterminer `INITIAL_WATERMARK` :
- Connectez-vous à PostgreSQL
- Exécutez : `SELECT MAX(id) FROM campaign_views;`
- Utilisez cette valeur pour éviter de recevoir toutes les notifications historiques

#### Health Check

Dans l'onglet **Health Check** :
- **Enabled** : Oui
- **Path** : `/health`
- **Port** : `3000`
- **Interval** : `30s`
- **Timeout** : `5s`
- **Retries** : `3`

#### Port Mapping (optionnel)

Si vous voulez accéder au health check publiquement :
- **Container Port** : `3000`
- **Public Port** : Laisser Coolify choisir ou spécifier

Sinon, laissez vide (le health check fonctionne en interne).

#### Volume Persistant (optionnel mais recommandé)

Pour persister le watermark entre redéploiements :

1. Dans **Persistent Storage**, ajouter un volume :
   - **Name** : `state-data`
   - **Mount Path** : `/data`
   - **Host Path** : Laisser Coolify gérer

### Étape 4 : Déployer

1. Cliquer sur **Deploy**
2. Suivre les logs de build en temps réel
3. Attendre que le statut passe à **Running**

### Étape 5 : Vérifier

#### Vérifier les logs

Dans Coolify, onglet **Logs**, vous devriez voir :

```
{"level":"info","time":"...","msg":"Configuration loaded and validated successfully"}
{"level":"info","time":"...","msg":"Successfully connected to PostgreSQL","host":"..."}
{"level":"info","time":"...","msg":"Health check server started","port":3000}
{"level":"info","time":"...","msg":"Monitor service started","pollIntervalMs":5000}
```

#### Tester le health check

Si vous avez exposé le port 3000 publiquement :

```bash
curl https://listmonk-alert.votre-domaine.com/health
```

Sinon, utilisez le shell Coolify :

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

#### Tester avec un email réel

1. Envoyer une campagne test depuis Listmonk
2. Ouvrir l'email
3. Attendre 5-10 secondes
4. Vous devriez recevoir une notification dans Google Chat

### Étape 6 : Monitoring

#### Logs en temps réel

Dans Coolify → **Logs** → activer **Live Logs**

Vous verrez :
- Détection de nouvelles vues
- Envoi de notifications
- Erreurs éventuelles

#### Métriques

Le health check donne :
- `lastWatermark` : Dernier ID traité
- `monitorRunning` : Confirme que le monitoring fonctionne

#### Alertes Coolify

Configurer des alertes dans Coolify pour être notifié si :
- L'application crash
- Le health check échoue
- Utilisation ressources anormale

## Déploiement Docker Manuel

Si vous n'utilisez pas Coolify :

### 1. Build l'image

```bash
docker build -t listmonk-alert:latest .
```

### 2. Créer un fichier .env

Copier `.env.example` et remplir les valeurs.

### 3. Run le conteneur

```bash
docker run -d \
  --name listmonk-alert \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v listmonk-alert-data:/data \
  listmonk-alert:latest
```

### 4. Vérifier

```bash
# Logs
docker logs -f listmonk-alert

# Health check
curl http://localhost:3000/health

# Stats
docker stats listmonk-alert
```

## Déploiement avec Docker Compose

Créer `docker-compose.yml` :

```yaml
version: '3.8'

services:
  listmonk-alert:
    build: .
    container_name: listmonk-alert
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
    volumes:
      - state-data:/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - listmonk-network

volumes:
  state-data:

networks:
  listmonk-network:
    external: true  # Si Listmonk est dans ce réseau
    # Ou:
    # driver: bridge
```

Lancer :

```bash
docker-compose up -d
docker-compose logs -f
```

## Mise à Jour

### Avec Coolify

1. Pusher les changements sur Git
2. Dans Coolify, cliquer sur **Redeploy**
3. Coolify rebuild et redéploie automatiquement

Le watermark est préservé grâce au volume persistant `/data`.

### Avec Docker

```bash
# Pull latest code
git pull

# Rebuild
docker build -t listmonk-alert:latest .

# Stop et remove old container
docker stop listmonk-alert
docker rm listmonk-alert

# Run new container (le volume /data persiste)
docker run -d \
  --name listmonk-alert \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v listmonk-alert-data:/data \
  listmonk-alert:latest
```

## Rollback

### Avec Coolify

Dans l'onglet **Deployments** :
1. Trouver le déploiement précédent fonctionnel
2. Cliquer sur **Redeploy**

### Avec Docker

```bash
# Run la version précédente
docker run -d \
  --name listmonk-alert \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v listmonk-alert-data:/data \
  listmonk-alert:previous-tag
```

## Troubleshooting

### Logs ne s'affichent pas

Vérifier que `LOG_LEVEL` est à `info` ou `debug`.

### Erreur de connexion PostgreSQL

- Vérifier que le serveur PostgreSQL est accessible depuis Coolify
- Tester avec : `nc -zv DB_HOST DB_PORT`
- Vérifier les credentials

### Notifications ne partent pas

- Vérifier le webhook Google Chat avec le script test
- Regarder les logs pour les erreurs
- Vérifier que `GOOGLE_CHAT_WEBHOOK_URL` est correcte

### Application redémarre en boucle

- Regarder les logs Coolify
- Vérifier les variables d'environnement
- Vérifier que le health check est correctement configuré

### Trop de notifications au démarrage

- Mettre `INITIAL_WATERMARK` au dernier ID existant
- Redéployer

## Maintenance

### Backup du watermark

```bash
# Récupérer le state file
docker cp listmonk-alert:/data/state.json ./backup-state.json
```

### Restore du watermark

```bash
# Restaurer le state file
docker cp ./backup-state.json listmonk-alert:/data/state.json
docker restart listmonk-alert
```

### Nettoyage

```bash
# Nettoyer les images Docker inutilisées
docker image prune -a

# Voir l'utilisation du volume
docker system df -v
```

## Optimisation

### Ressources

Limites recommandées :

```yaml
# docker-compose.yml
services:
  listmonk-alert:
    # ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 128M
```

### Performances

- `POLL_INTERVAL_MS` : 5000ms par défaut, peut être réduit à 3000ms pour plus de réactivité
- `BATCH_SIZE` : 50 par défaut, augmenter si vous avez beaucoup de vues simultanées

## Support

En cas de problème :
1. Vérifier les logs
2. Vérifier la configuration
3. Tester avec `npm run test:connection`
4. Consulter [README.md](./README.md)
