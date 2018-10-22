# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.
use Mix.Config

# General application configuration
config :browsertown,
  ecto_repos: [Browsertown.Repo],
  generators: [binary_id: true]

# Configures the endpoint
config :browsertown, BrowsertownWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "RED/oPcb3bmZKE+JS62Srp5KEsVt74eI7ZfiOxJP9LC5GeRMvGrfAMDvP19iNxOU",
  render_errors: [view: BrowsertownWeb.ErrorView, accepts: ~w(html json)],
  pubsub: [name: Browsertown.PubSub,
           adapter: Phoenix.PubSub.PG2]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:user_id]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env}.exs"
