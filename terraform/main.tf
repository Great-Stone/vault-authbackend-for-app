provider "vault" {
  address = "http://localhost:8200"
  token   = "root"
}

resource "vault_auth_backend" "userpass" {
  type = "userpass"
}

resource "vault_identity_group" "internal" {
  name                       = "internal"
  type                       = "internal"
  external_member_entity_ids = false

  metadata = {
    version = "2"
  }
}

resource "vault_policy" "example" {
  name = "dev-team"

  policy = <<EOT
path "secret/my_app" {
  capabilities = ["update"]
}
EOT
}

resource "vault_identity_entity" "user1" {
  name     = "User 1"
  policies = []

  metadata = {
    email = "hello@test.com"
  }
}

resource "vault_identity_group_member_entity_ids" "members" {

  exclusive         = true
  member_entity_ids = [vault_identity_entity.user1.id]
  group_id          = vault_identity_group.internal.id
}

resource "vault_identity_entity_alias" "user1" {
  name           = "user1"
  mount_accessor = vault_auth_backend.userpass.accessor
  canonical_id   = vault_identity_entity.user1.id
}

locals {
  username = "user1"
  password = "user1"
}

resource "vault_generic_endpoint" "user1" {
  depends_on           = [vault_auth_backend.userpass]
  path                 = "auth/userpass/users/${local.username}"
  ignore_absent_fields = true

  data_json = <<EOT
{
  "policies": ["${vault_policy.example.name}"],
  "password": "${local.password}"
}
EOT
}

resource "vault_identity_oidc_client" "test" {
  name = "my-app"
  redirect_uris = [
    // "http://127.0.0.1:9200/v1/auth-methods/oidc:authenticate:callback",
    // "http://127.0.0.1:8251/callback",
    "http://127.0.0.1:8080/login/callback",
    "https://oidcdebugger.com/debug"
  ]
  assignments = [
    "allow_all"
  ]
  id_token_ttl     = 2400
  access_token_ttl = 7200
}

resource "vault_identity_oidc_scope" "test" {
  name = "groups"
  template = jsonencode(
    {
      groups = "{{identity.entity.groups.names}}",
    }
  )
  description = "Groups scope."
}

resource "vault_identity_oidc_provider" "test" {
  name = "test"
  allowed_client_ids = [
    vault_identity_oidc_client.test.client_id
  ]
  scopes_supported = [
    vault_identity_oidc_scope.test.name
  ]
}

data "vault_identity_oidc_openid_config" "test" {
  name = vault_identity_oidc_provider.test.name
}

data "template_file" "main_js" {
  template = "${file("${path.module}/tpl/index.js.tpl")}"
  vars = {
    oidc_client_id = vault_identity_oidc_client.test.client_id
    oidc_client_secret = vault_identity_oidc_client.test.client_secret
    oidc_config_issuer = data.vault_identity_oidc_openid_config.test.issuer
  }
}

resource "local_file" "main_js" {
  content = data.template_file.main_js.rendered
  filename = "${path.module}/../index.js"
}