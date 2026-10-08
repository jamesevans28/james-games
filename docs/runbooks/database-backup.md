# Database backups and restore

## What runs

`.github/workflows/db-backup.yml` runs nightly (01:43 AEST) and on demand. It runs `pg_dump --format=custom` against the Supabase **session pooler** and uploads the result to `s3://$BACKUP_BUCKET/db/<YYYY-MM-DD>.dump`. The bucket's lifecycle rule deletes objects after 30 days. Supabase's own daily backups on the free plan are not downloadable, so this is the copy we control.

## One-time setup, MANUAL (James)

1. Create the bucket in ap-southeast-2. Block all public access. Change `<account-id>` to yours:
   ```bash
   aws s3api create-bucket --bucket games4james-backups-<account-id> --region ap-southeast-2 --create-bucket-configuration LocationConstraint=ap-southeast-2
   ```
   ```bash
   aws s3api put-public-access-block --bucket games4james-backups-<account-id> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```
2. Add a lifecycle rule that expires objects after 30 days:
   ```bash
   aws s3api put-bucket-lifecycle-configuration --bucket games4james-backups-<account-id> --lifecycle-configuration '{"Rules":[{"ID":"expire-30d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":30}}]}'
   ```
3. Let the GitHub OIDC role (the one in the `AWS_ROLE_TO_ASSUME` secret) put objects there. Add an inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::games4james-backups-<account-id>/db/*"
       }
     ]
   }
   ```
4. In GitHub, add the repo variable `BACKUP_BUCKET` with the bucket name. The secret `DATABASE_URL_MIGRATIONS` comes from T6.1.
5. Go to Actions → **Database backup** → Run workflow, and check the object appears.

## Restore (test this once)

1. Create a scratch Supabase project, or use the local stack's Postgres if you have Docker.
2. Download a dump:
   ```bash
   aws s3 cp s3://<bucket>/db/<date>.dump ./db.dump
   ```
3. Restore it into the scratch database. Use the session-pooler URL of the **scratch** project, never production:
   ```bash
   docker run --rm -v "$PWD:/w" postgres:17 pg_restore --no-owner --no-privileges --clean --if-exists -d "<scratch session pooler URL>" /w/db.dump
   ```
4. Point a local API at it (`DATABASE_URL` in `apps/backend-api/.env.local`), run `npm run server`, and check a leaderboard.
5. Write the date you tested it here:

| Date tested | By  | Notes |
| ----------- | --- | ----- |
