output "oidc_client_id" {
  value = vault_identity_oidc_client.test.client_id
}

output "oidc_client_secret" {
  value = nonsensitive(vault_identity_oidc_client.test.client_secret)
}

output "oidc_config_issuer" {
  value = data.vault_identity_oidc_openid_config.test.issuer
}

output "test_user_username" {
  value = local.username
}

output "test_user_password" {
  value = local.password
}