require 'rubygems'
require 'sinatra'
require 'sass'
require 'compass'

class ReinventLots < Sinatra::Application
  configure do
    Compass.configuration do |config|
      config.project_path = File.dirname(__FILE__)
      config.sass_dir = 'views'
    end

    set :scss, Compass.sass_engine_options
  end

  helpers do
    def link_to(url,text=url,opts={})
      attributes = ""
      opts.each { |key,value| attributes << key.to_s << "=\"" << value << "\" "}
      "<a href=\"#{url}\" #{attributes}>#{text}</a>"
    end
  end

  get '/' do
    erb :index
  end

  get '/css/main.css' do
    content_type 'text/css', :charset => 'utf-8'
    scss :main
  end
end
