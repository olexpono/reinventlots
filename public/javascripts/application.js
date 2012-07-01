
function Reinvent() {
  var args = Array.prototype.slice.call(arguments),
  callback = args.pop(),
  modules = (args[0] && typeof args[0] === "string") ? args : args[0],
  config,
  i;

  if (!(this instanceof Reinvent)) {
    return new Reinvent(modules, callback);
  }

  if (!modules || modules === '*') {
    modules = [];
    for (i in Reinvent.modules) {
      if (Reinvent.modules.hasOwnProperty(i)) {
        modules.push(i);
      }
    }
  }

  for (i = 0; i < modules.length; i += 1) {
    Reinvent.modules[modules[i]](this);
  }

  callback(this);
  return this;
}

Reinvent.modules = {};

Reinvent.modules.app = function(reinvent) {

  reinvent.app = {};

  reinvent.app.Instance = Class.extend({
    init: function(map, options) {
      reinvent.log.info('app init');
      this.options = _.defaults(options, {
          logging: false
      });
      reinvent.log.enabled = options ? options.logging: false;
      this._map = map;
      //TODO we can split each of these up, to run only what we need for a particular view
      this.maplayer = new reinvent.maplayer.Engine(this._map, {});
      this.imguruploader = new reinvent.imguruploader.Engine(this.options.imgur_form_id);
      this.datalayer = new reinvent.datalayer.Engine(this._map, {});
      this.lot = new reinvent.lot.Engine('RL-xTR93w', {});
    },
    run: function() {
        this.maplayer.run();
        this.imguruploader.run();
        this.lot.run();
        reinvent.log.info('app running');
        $("#userForm").submit(function() {
          Reinvent.app.logImage($("#userForm"));
          var imgur_callback = function(imgur_data) {
            Reinvent.app.createPlace(this, imgur_data);
          }
          Reinvent.app.imguruploader.uploadImage(
              $("#imgur_upload input[type=file]")[0].files[0],
              imgur_callback
          );
          return false; // prevents actual HTTP submit
        });
    },
    logImage: function(form){
        reinvent.log.info(form);
        reinvent.log.info('blocked');
    },
    createPlace: function(form, imgur_data) {
      reinvent.log.info('Uploaded to imgur! ' + imgur_data.upload.links.imgur_page);
      var create_params = {};
      var place_location = Reinvent.app.maplayer.getLocation();
      create_params["lat"] = place_location[0];
      create_params["lng"] = place_location[1];
      create_params["name"] = "TODO: Place Names";
      create_params["address"] = Reinvent.app.maplayer.getAddress();
      create_params["orig"] = imgur_data.upload.links.original;
      create_params["small"] = imgur_data.upload.links.large_thumbnail;
      create_params["thumb"] = imgur_data.upload.links.small_square;
      reinvent.log.info(create_params)
      $.ajax({
        type: "POST",
        url: "/api/create",
        data:  create_params,//JSON.stringify(create_params)
      }).done( function(data) {
        reinvent.log.info("created! :: data = " + data);
      });
    }
  });
};

Reinvent.modules.imguruploader = function(reinvent) {
    reinvent.imguruploader = {};
    reinvent.imguruploader.Engine = Class.extend({
        init: function(divid) {
            this._divid = divid;
        },
        run: function(){
        },
        uploadImage: function(file, callback){
            if (!file || !file.type.match(/image.*/)) return;

            var fd = new FormData();
            fd.append("image", file);
            fd.append("key", "3e1abddad6fba082f7d20aa9ea3ef783");

            var xhr = new XMLHttpRequest();
            xhr.open("POST", "http://api.imgur.com/2/upload.json");
            xhr.onload = function() {
               var parsedResponse = JSON.parse(xhr.responseText);
               callback(parsedResponse);
            }

            xhr.send(fd);
        }
    });
}

Reinvent.modules.lot = function(reinvent) {
    reinvent.lot = {};
    reinvent.lot.Engine = Class.extend({
        init: function(lotHash, options) {
          this.options = _.defaults(options, {
              table: 'reinvent_lots',
              domain: 'ecohack12'
          });
          this.lotHash = lotHash;
        },
        run: function(){
            this.getOverview(function(data){Reinvent.app.lot.populatePage(data)});
            this.getImages(function(data){Reinvent.app.lot.populateGallery(data)});
        },
        getOverview: function(callback){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this._overviewSql(),
              success: callback
            });
        },
        populatePage: function(data){
            // TODO fill title etc dom with this information
            console.log(data.rows[0].name + ": " + data.rows[0].address );
        },
        getImages: function(callback){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this._imagesSql(),
              success: callback
            });
        },
        populateGallery: function(data){
            // TODO fill gallery dom with this information
            for (var i = 0; i<data.rows.length; i++){
                console.log("Small: "+data.rows[i].imgur_small);
                console.log("Large: "+data.rows[i].imgur_large);
                console.log("Original: "+data.rows[i].imgur_orig);
            }
        },
        _imagesSql: function(){
            return "SELECT cartodb_id, ST_X(the_geom) lng, ST_Y(the_geom) lat, hash, imgur_small, imgur_thumb, imgur_orig FROM "+this.options.table+" WHERE hash = '"+this.lotHash+"' AND the_geom IS NOT NULL ORDER BY created_at desc"
        },
        _overviewSql: function(){
            return "SELECT ST_X(the_geom) lng, ST_Y(the_geom) lat, hash, address, name FROM "+this.options.table+" WHERE hash = '"+this.lotHash+"' AND the_geom IS NOT NULL ORDER BY created_at asc LIMIT 1"
        }
    });
}


Reinvent.modules.datalayer = function(reinvent) {
    reinvent.datalayer = {};
    reinvent.datalayer.Engine = Class.extend({
        init: function(options) {
          this.options = _.defaults(options, {
              nlots: 10,
              table: 'reinvent_lots',
              domain: 'ecohack12'
          });
          this.markers = [];
        },
        getSql: function(){
            var place_location = Reinvent.app.maplayer.getLocation();
            return "SELECT ST_X(the_geom) lng, ST_Y(the_geom) lat, address, name, hash, imgur_small FROM "+this.options.table+" WHERE the_geom IS NOT NULL ORDER BY the_geom <-> st_setsrid(st_makepoint("+place_location[1]+","+place_location[0]+"),4326) LIMIT "+this.options.nlots
        },
        getNearestLots: function(callback){
            $.ajax({
              type: 'post',
              dataType: 'json',
              url: "http://"+this.options.domain+".cartodb.com/api/v2/sql?q="+this.getSql(),
              success: callback
            });
        },
        plotLots: function(lots){
            for (var i=0; i<lots.rows.length; i++){
                var marker = Reinvent.app.maplayer.newMarker(lots.rows[i]);
                this.markers.push(marker);
            }
        },
        clearMarkers: function(){
            for (var i=0;i<this.markers.length;i++){
                this.markers[i].setMap(null);
                delete this.markers[i]
            }
            this.markers = [];
        }
    });
}

Reinvent.modules.maplayer = function(reinvent) {
    reinvent.maplayer = {};
    reinvent.maplayer.Engine = Class.extend({
        init: function(map, options) {
            reinvent.log.info('map engine init');
            var that = this;
            this._map = map;
            this.lat = null;
            this.lng = null;
            this.marker = null;
            this.address = null;
            this._geocoder = new google.maps.Geocoder();
            this._existing = "http://www.google.com/intl/en_us/mapfiles/ms/micons/blue-dot.png";
        },
        run: function(){
            this.panToUser();
            this.setupListeners();
            Reinvent.app.datalayer.getNearestLots(function(data) {
                Reinvent.app.datalayer.plotLots(data);
            });
        },
        setupListeners: function(){
            //TODO remove the below when we have a button for Drop Pin
            google.maps.event.addListener(this._map, 'click', function(event) {
              Reinvent.app.maplayer.dropPin();
            });
        },
        setAddress: function(address){
            this.address = address;
        },
        getAddress: function(){
            return this.address
        },
        centerPin: function(latLng){
          this.marker.setPosition(this._map.getCenter());  
    	  this.lat = this._map.getCenter().lat();
    	  this.lng = this._map.getCenter().lng();
        },
        dropPin: function(){
          var latLng = this._map.getCenter();
          // Pin is the user generated marker
          if ( this.marker ) {
            this.marker.setPosition(latLng);
          } else {
            this.marker = new google.maps.Marker({
              position: latLng,
              map: this._map,
              animation: google.maps.Animation.DROP,
              draggable: true
            });
          }
          
          google.maps.event.addListener(this._map, 'dragend', function() {
              Reinvent.app.maplayer.centerPin();
          });
          
    	  this.lat = latLng.lat();
    	  this.lng = latLng.lng();
          this._geocoder.geocode({location: latLng}, function(addresses){
              Reinvent.app.maplayer.setAddress(addresses[0].formatted_address)
          })
          this._map.setCenter(latLng);
        },
        panToUser: function(){
            var that = this;
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position){
                        that.locationSuccess(position);
                    }, 
                    this.locationFail);
            } 
        },
        locationSuccess: function(position){
    	    this.lat = position.coords.latitude;
    	    this.lng = position.coords.longitude;
		    var latLng = new google.maps.LatLng(this.lat, this.lng);
            this._geocoder.geocode({location: latLng}, function(addresses){
                Reinvent.app.maplayer.setAddress(addresses[0].formatted_address);
            });
            this._map.setCenter(latLng);
        },
        locationFail: function(position){
            // pass
        },
        newMarker: function(data){
		    var latLng = new google.maps.LatLng(data.lat, data.lng);
            var newMarker = new google.maps.Marker({
              position: latLng,
              map: this._map,
              icon: this._existing
            });
            return newMarker;
        },
        getLocation: function(position) {
          return [this.lat, this.lng];
        },
    });
    reinvent.maplayer.Display = Class.extend({
        /**
         * Constructs a new Display with the given DOM element.
         */
        init: function(map) {
            this._map = map;
        },
        setEngine: function(engine) {
            this._engine = engine;
        },
        addPin: function(pin) {
            // TODO
        }
    });
}
/**
 * Logging module that reinventtes log messages to the console
 *
 */
Reinvent.modules.log = function(reinvent) {
  reinvent.log = {};

  reinvent.log.info = function(msg) {
    reinvent.log._reinventte('INFO: ' + msg);
  };

  reinvent.log.warn = function(msg) {
    reinvent.log._reinventte('WARN: ' + msg);
  };

  reinvent.log.error = function(msg) {
    reinvent.log._reinventte('ERROR: ' + msg);
  };

  reinvent.log.todo = function(msg) {
    reinvent.log._reinventte('TODO: '+ msg);
  };

  reinvent.log._reinventte = function(msg) {
    var logger = window.console;
    if (reinvent.log.enabled) {
      if (logger && logger.markTimeline) {
        logger.markTimeline(msg);
      }
      //console.log(msg);
    }
  };
};
