(function($, undefined){
    $.widget('surfjudge.heat_activity_button', {
        options: {
            heat_id: null,
            data: null,
            button_text_active: "Stop Heat",
            button_text_inactive: "Start Heat",

            getactiveheatsurl: '/rest/active_heats',
            poststartheaturl: '/rest/start_heat',
            poststopheaturl: '/rest/stop_heat',
        },

        _create: function(){
            this._heat_is_active = false;

            this.data = this.options.data;

            this._init_html();
            this._register_events();
            this._initialized = this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<button class="btn btn-default btn-lg heat_activity_btn" data-status="inactive"></button>',
            ].join(' '));

            this.element.append(html);
        },

        load: function(data){
            // refresh using provided data
            this.data = data;
            this._refresh();
        },

        refresh: function(){
            // load data from server and refresh
            var _this = this;
            var deferred = $.Deferred();
            $.getJSON(this.options.getactiveheatsurl, function(active_heats){
                _this.data = active_heats;
                _this._refresh();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _refresh: function(){
            // refresh visualization and internal state
            var _this = this;
            this._heat_is_active = false;
            $.each(this.data, function(key, val){
                console.log(val['id']);
                console.log(_this.options.heat_id);
                if (_this.options.heat_id === val['id'])
                    _this._heat_is_active = true;
            });
            _this._visualize_heat_status();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .heat_activity_btn': this.toggle_heat_activity,
            })
        },

        _visualize_heat_status: function(){
            var elem = this.element.find('.heat_activity_btn');
            if (this._heat_is_active) {
                elem.addClass('btn-danger');
                elem.removeClass('btn-success');
                elem.data('status', 'active');
                elem.text(this.options.button_text_active);
            } else {
                elem.addClass('btn-success');
                elem.removeClass('btn-danger');
                elem.data('status', 'inactive');
                elem.text(this.options.button_text_inactive);
            }
        },

        toggle_heat_activity: function(){
            if (this._heat_is_active)
                this.deactivate_heat();
            else
                this.activate_heat();
        },

        activate_heat: function(){
            var _this = this;
            $.post(this.options.poststartheaturl, {heat_id: this.options.heat_id})
                .done(function(){
                    _this._heat_is_active = true;
                    _this._visualize_heat_status();
                    _this.refresh();
                    _this._trigger('heat_activity_changed', null);
                });
        },

        deactivate_heat: function(){
            var _this = this;
            $.post(this.options.poststopheaturl, {heat_id: this.options.heat_id})
                .done(function(){
                    _this._heat_is_active = false;
                    _this._visualize_heat_status();
                    _this.refresh();
                    _this._trigger('heat_activity_changed', null);
                });
        },

        heat_is_active: function(){
            return this._heat_is_active;
        },

        initialized: function(){
            return this._initialized;
        },
    });

}(jQuery));
