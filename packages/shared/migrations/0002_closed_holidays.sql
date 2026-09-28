ALTER TABLE "availability_rule" DROP CONSTRAINT "availability_rule_row_kind_check";--> statement-breakpoint
ALTER TABLE "availability_rule" ADD COLUMN "closedHolidays" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_holidays_need_country_check" CHECK ("availability_rule"."closedHolidays" = '[]'::jsonb or "availability_rule"."holidayCountry" is not null);--> statement-breakpoint
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_row_kind_check" CHECK ((
        "availability_rule"."resourceId" is null
        and "availability_rule"."weeklyHours" is not null
        and "availability_rule"."timezone" is not null
        and "availability_rule"."minimumNoticeMinutes" is not null
        and "availability_rule"."horizonDays" is not null
        and "availability_rule"."closedDates" is not null
      ) or (
        "availability_rule"."resourceId" is not null
        and "availability_rule"."timezone" is null
        and "availability_rule"."minimumNoticeMinutes" is null
        and "availability_rule"."horizonDays" is null
        and "availability_rule"."closedDates" is null
        and "availability_rule"."holidayCountry" is null
        and "availability_rule"."holidayRegion" is null
        and "availability_rule"."closedHolidays" = '[]'::jsonb
      ));