defmodule BrowsertownWeb.PageController do
  use BrowsertownWeb, :controller

  def index(conn, _params) do
    render conn, "index.html"
  end
end
