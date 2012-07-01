
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
      this.maplayer = new reinvent.maplayer.Engine(this._map, {})
      this.imguruploader = new reinvent.imguruploader.Engine(this.options.imgur_form_id)
    },
    run: function() {
        this.maplayer.run();
        this.imguruploader.run();
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
        },
        run: function(){
            this.panToUser();
            this.setupListeners();
        },
        setupListeners: function(){
            google.maps.event.addListener(this._map, 'click', function(event) {
              Reinvent.app.maplayer.dropPin(event.latLng);
            });
        },
        setAddress: function(address){
            this.address = address;
        },
        getAddress: function(){
            return this.address
        },
        dropPin: function(latLng){
          if ( this.marker ) {
            this.marker.setPosition(latLng);
          } else {
            this.marker = new google.maps.Marker({
              position: latLng,
              map: this._map
            });
          }
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
        getLocation: function(position) {
            console.log(this.lat, this.lng)
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
