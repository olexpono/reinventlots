require 'rubygems'
require 'sinatra'
require 'sass'
require 'compass'
require "json"
require "uri"
require "net/http"
require "yaml"
require 'active_support'

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


if ENV['CARTODB_KEY']
  # LOAD CARTO_CONF from ENV variables
  CARTODB_CONF = {}
  CARTODB_CONF['api_key'] = ENV['CARTODB_KEY']
  CARTODB_CONF['locations_table'] = ENV['CARTODB_LOCTABLE']
  CARTODB_CONF['post_url'] = ENV['CARTODB_POSTURL']
else
  CARTODB_CONF = YAML::load(File.read('config/cartodb_config.yml'))
end

def quote_string astr
  return astr.gsub(/\A['"]+|['"]+\Z/, "").gsub(/\\/, '\&\&').gsub(/'/, "''").gsub(';',' ')
end

post '/api/create' do
  map = {}
  params.each_pair do |k,v|
    if v.is_a? String
      map[k] = quote_string(v)
    end
  end
  # puts 'RECEIVED CREATE CALL ' + map.inspect

  address_check = "SELECT count(*) FROM #{CARTODB_CONF['locations_table']} WHERE address = '#{map['address']}'"
  send = {'q'=>address_check, 'api_key'=>CARTODB_CONF['api_key']}
  y = Net::HTTP.post_form(URI.parse(CARTODB_CONF['post_url']), send)
  if JSON.parse(y.body)['rows'].first['count'].to_i>0
    {"error"=>"Location already exists"}.to_json
  else
  
    map['hash'] = "RL-#{ActiveSupport::SecureRandom.base64(4).gsub("/","_").gsub(/=+$/,"")}"
    map['created'] = Time.now.getutc
    
    sql = "INSERT INTO #{CARTODB_CONF['locations_table']}(the_geom, hash, name, description, address, imgur_orig, imgur_small, imgur_thumb) VALUES (ST_SetSRID(ST_MakePoint(#{map['lng']},#{map['lat']}),4326), '#{map['hash']}', '#{map['name']}', '#{map['desc']}', '#{map['address']}', '#{map['orig']}', '#{map['small']}', '#{map['thumb']}')"
    req = "http://#{CARTODB_CONF['host']}.cartodb.com/api/v2/sql"
  
    send = {'q'=>sql, 'api_key'=>CARTODB_CONF['api_key']}
    x = Net::HTTP.post_form(URI.parse(CARTODB_CONF['post_url']), send)
    map.to_json
  end
end

get '/api/add' do
  map = {}
  params.each_pair do |k,v|
    map[k] = quote_string(v)
  end
  address_check = "SELECT count(*) FROM #{CARTODB_CONF['locations_table']} WHERE hash = '#{map['hash']}'"
  params = {'q'=>address_check, 'api_key'=>CARTODB_CONF['api_key']}
  y = Net::HTTP.post_form(URI.parse(CARTODB_CONF['post_url']), params)
  
  if JSON.parse(y.body)['rows'].first['count']==0
    {"error"=>"Location does not exist"}.to_json
  else
    sql = "INSERT INTO #{CARTODB_CONF['locations_table']}(the_geom, hash, name, description, address, imgur_orig, imgur_small, imgur_thumb) VALUES (ST_SetSRID(ST_MakePoint(#{map['lng']},#{map['lat']}),4326), '#{map['hash']}', '#{map['name']}', '#{map['desc']}', '#{map['address']}', '#{map['orig']}', '#{map['small']}', '#{map['thumb']}')"
    req = "http://#{CARTODB_CONF['host']}.cartodb.com/api/v2/sql"
  
  
    params = {'q'=>sql, 'api_key'=>CARTODB_CONF['api_key']}
    x = Net::HTTP.post_form(URI.parse(CARTODB_CONF['post_url']), params)
  
    map[:added] = time = Time.now.getutc
  
    map.to_json
  end
end
