ALTER TABLE "bots" ADD COLUMN "messageFlow" JSONB NOT NULL DEFAULT '[]';

UPDATE "bots"
SET "messageFlow" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', 'welcome',
      'title', 'Welcome message',
      'type', CASE WHEN "welcomeVideoUrl" IS NOT NULL AND btrim("welcomeVideoUrl") <> '' THEN 'VIDEO' ELSE 'TEXT' END,
      'text', COALESCE(NULLIF(btrim("welcomeText"), ''), 'Escolha uma opção abaixo.'),
      'mediaUrl', NULLIF(btrim("welcomeVideoUrl"), ''),
      'delayMs', 0,
      'buttons', (
        SELECT COALESCE(jsonb_agg(button), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object(
            'id', 'checkout',
            'label', "checkoutButtonText",
            'color', CASE "checkoutButtonStyle" WHEN 'success' THEN 'GREEN' WHEN 'danger' THEN 'RED' ELSE 'BLUE' END,
            'action', 'LIVEPIX_PAYMENT'
          ) AS button,
          1 AS sort_order
          UNION ALL
          SELECT jsonb_build_object(
            'id', 'support',
            'label', "supportButtonText",
            'color', CASE "supportButtonStyle" WHEN 'success' THEN 'GREEN' WHEN 'danger' THEN 'RED' ELSE 'BLUE' END,
            'action', 'OPEN_URL',
            'url', "supportUrl"
          ) AS button,
          2 AS sort_order
          WHERE "supportUrl" IS NOT NULL AND btrim("supportUrl") <> ''
          ORDER BY sort_order
        ) buttons
      )
    )
  )
);

ALTER TABLE "bots" DROP COLUMN "welcomeVideoUrl";
ALTER TABLE "bots" DROP COLUMN "welcomeText";
ALTER TABLE "bots" DROP COLUMN "checkoutButtonText";
ALTER TABLE "bots" DROP COLUMN "checkoutButtonStyle";
ALTER TABLE "bots" DROP COLUMN "supportButtonText";
ALTER TABLE "bots" DROP COLUMN "supportButtonStyle";
ALTER TABLE "bots" DROP COLUMN "supportUrl";
