ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_key_unique UNIQUE (user_id, key);

ALTER TABLE user_autonomy
  ADD CONSTRAINT user_autonomy_user_action_unique UNIQUE (user_id, action);

ALTER TABLE linear_installations
  ADD CONSTRAINT linear_installations_user_org_unique UNIQUE (user_id, organization_id);
