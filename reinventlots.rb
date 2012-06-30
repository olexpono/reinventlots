require 'rubygems'
require 'sinatra'
require 'sass'
require 'compass'
require "json"
require "uri"
require "net/http"

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


#CARTODB_CONF = YAML.load_file(Rails.root.join('config/cartodb_config.yml'))[RAILS_ENV]
CARTODB_CONF = YAML::load(File.read('config/cartodb_config.yml'))
def quote_string astr
  return astr.gsub(/\A['"]+|['"]+\Z/, "").gsub(/\\/, '\&\&').gsub(/'/, "''").gsub(';',' ')
end

get '/api/create' do
  map = {}
  params.each_pair do |k,v|
    map[k] = quote_string(v)
  end
  map[:hash] = 'Fd35ki'
  
  sql = "INSERT INTO #{CARTODB_CONF['locations_table']}(the_geom, hash, name, description, address, imgur_orig, imgur_small, imgur_thumb) VALUES (ST_SetSRID(ST_MakePoint(#{map[:lng]},#{map[:lat]}),4326), '#{map[:hash]}', '#{map[:name]}', '#{map[:desc]}', '#{map[:address]}', '#{map[:orig]}', '#{map[:small]}', '#{map[:thumb]}')"
  req = "http://#{CARTODB_CONF['host']}.cartodb.com/api/v2/sql"
  
  
  params = {'q'=>sql, 'api_key'=>CARTODB_CONF['api_key']}
  x = Net::HTTP.post_form(URI.parse(CARTODB_CONF['post_url']), params)
  
  map[:created] = time = Time.now.getutc
  
  map.to_json
end
